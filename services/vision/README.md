# AEGIS Vision Service

Stage 1 of the AEGIS pipeline — flood segmentation and object detection — as a
standalone FastAPI service.

It is separate from the command centre for one practical reason: PyTorch cannot
run where the Next.js app deploys. Keeping it separate means the command centre
stays a single deployable artifact with a live URL, and the vision service runs
wherever there is a GPU (or a patient CPU).

## What actually works, and when

| Capability | Needs training? | Runs on CPU? | Status out of the box |
|---|---|---|---|
| **Object detection** — person, animal, vehicle counts | **No** | Yes (~1–3 s/frame) | **Real.** Pretrained COCO weights already cover the classes stage 3 needs. |
| **Flood segmentation — classical** | No | Yes | **Real method**, lower ceiling. NDWI-analogue + Otsu. |
| **Flood segmentation — U-Net** | Yes (FloodNet) | Training needs a GPU | Ships untrained. Run `train_unet.py`. |
| **Structural damage classification** | Yes (xBD) | — | Not included. Reported as `null`, never as `0`. |

That last row matters. An unmodelled quantity is not zero, and a service that
returns `0` for damage it never measured would feed a resource allocation with a
number nobody computed. It returns `null` and says why.

## Run it

From the repo root, once the venv exists:

```bash
npm run vision
```

That finds the interpreter, prints what the service can actually do — trained
U-Net or classical baseline, detector present or not — and starts it.

First-time setup:

```bash
cd services/vision
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt    # Windows
.venv/bin/python -m pip install -r requirements.txt        # macOS / Linux
```

On Windows, note that `python` on PATH is often the Microsoft Store stub, which
is not a real interpreter. If `python --version` opens the Store, use the real
one directly — typically
`%LOCALAPPDATA%\Programs\Python\Python311\python.exe`. **Use 3.11 or 3.12**;
PyTorch and Ultralytics do not yet publish wheels for 3.14.

Torch is ~2 GB. For a CPU-only box, take the CPU wheel — it is much smaller than
the default CUDA build:

```bash
.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python -m pip install ultralytics
```

Ultralytics downloads `yolov8n.pt` (~6 MB) on first inference. Check what loaded:

```bash
curl http://localhost:8000/health
```

Analyse a frame:

```bash
curl -X POST http://localhost:8000/analyse \
  -F "image=@sample_flood.jpg" | python -m json.tool
```

## Connect it to the command centre

```bash
# in the repo root .env.local
VISION_SERVICE_URL=http://localhost:8000
```

The pipeline probes `/health` on every run. If the service answers, stage 1
reports which model produced each field. If it does not, the pipeline falls back
to the incident model and labels the output SIMULATED. It never blocks and never
fails because the service is down — a vision service that is unreachable during
a flood must degrade the analysis, not take the control room offline.

## Train the U-Net

There is no NVIDIA GPU on the machine this was built on, so training is expected
to happen on a free Colab or Kaggle T4 — roughly two hours to a usable mean-IoU.

```bash
python train_unet.py --data /path/to/FloodNet --epochs 40 --batch 8
```

FloodNet-Supervised_v1.0 ships UAV imagery from Hurricane Harvey with per-pixel
labels. The defaults map classes 1 (`building-flooded`), 3 (`road-flooded`) and
5 (`water`) to water. **Re-check `--flood-classes` if you swap datasets** —
Sen1Floods11 uses a different scheme, and getting this wrong trains a confident
model on the wrong target.

Drop the resulting checkpoint at `weights/unet_floodnet.pt` (or point
`AEGIS_UNET_WEIGHTS` at it) and restart. `/health` will report
`"trained": true` and the command centre will start labelling stage 1 as real.

**Report your own measured mean-IoU.** Published FloodNet baselines sit in the
0.70–0.80 range; citing that number for a model you did not train is the kind of
claim that does not survive a follow-up question.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AEGIS_UNET_WEIGHTS` | `weights/unet_floodnet.pt` | U-Net checkpoint; absent ⇒ classical baseline |
| `AEGIS_YOLO_WEIGHTS` | `yolov8n.pt` | Detector weights; a name downloads, a path loads |
| `AEGIS_DAMAGE_WEIGHTS` | unset | xBD-trained damage classifier |
| `AEGIS_DEVICE` | `cpu` | `cuda` when one is available |
| `AEGIS_MAX_EDGE` | `1600` | Long-edge cap — a 12,000 px orthomosaic on CPU never returns |
| `AEGIS_ALLOWED_ORIGINS` | `*` | Pin to the command centre's origin in deployment |

## Endpoints

- `GET /health` — what is loaded and what it can do
- `POST /analyse` — full stage 1: per-zone flood, counts, provenance
- `POST /segment` — water mask only, for eyeballing the segmenter

## Datasets

| Dataset | Use |
|---|---|
| [FloodNet](https://github.com/BinaLab/FloodNet-Supervised_v1.0) | Trains and benchmarks the U-Net |
| [xBD / xView2](https://xview2.org) | Would train the damage classifier |
| [Sen1Floods11](https://github.com/cloudtostreet/Sen1Floods11) | Satellite-scale flood extent |
| [RescueNet](https://www.nature.com/articles/s41597-023-02799-4) | UAV post-disaster scene understanding |
| [Bhuvan (ISRO/NRSC)](https://bhuvan.nrsc.gov.in) | India-specific imagery for a district pilot |

## Known failure modes

The classical baseline, stated plainly because they will show up on a real image:

- Shadow under cloud or buildings reads as water.
- Wet tarmac and dark roofs read as water.
- Silt-laden floodwater — which is exactly what Kosi-basin flood water looks
  like — reads weakly and is under-detected.

A trained U-Net fixes all three. Distinguishing natural water bodies from
floodwater, and detecting anything under cloud, remain open problems that
FloodNet's own authors flag.
