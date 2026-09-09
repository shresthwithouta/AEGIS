# Setup

Three terminals. Two of them are optional — the app runs without either.

---

## 1. The app — required

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

**This alone is a complete working demo.** Every page, the pipeline, both approval
gates, routing, the drone simulation, the doctrine assistant and the audit
register all work with nothing else running. Recommendations come from the rule
engines and are labelled `RULE ENGINE` on screen.

---

## 2. The AI — optional

Without this, stage 4 uses the deterministic rule engine. With it, two agents
investigate the incident and argue about the plan before a human sees it.

Create **`.env.local`** in the project root (same folder as `package.json`):

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
VISION_SERVICE_URL=http://127.0.0.1:8000
```

Get a key at <https://console.anthropic.com> → API Keys.

**Restart `npm run dev` afterwards** — env vars are only read at boot.

Confirm it worked: the header should read **Reasoning live** instead of
**Rule engine**, and `/system` will name the model.

---

## 3. The vision service — optional

Real flood segmentation and real YOLOv8 detection on an uploaded image.

Already installed on this machine. To start it:

```bash
npm run vision
```

It prints what it can do, then serves on port 8000. Leave it running.

Then on `/operations`, the **Imagery ingestion** panel accepts a dropped photo.

### If you need to set it up on another machine

```bash
cd services/vision
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows
.venv/bin/python -m pip install -r requirements.txt          # macOS / Linux
```

Use **Python 3.11 or 3.12**. PyTorch has no wheels for 3.14 yet.

On Windows, `python` on PATH is often the Microsoft Store stub, which is not a
real interpreter. If `python --version` opens the Store, call the real one
directly — usually `%LOCALAPPDATA%\Programs\Python\Python311\python.exe`.

For a CPU-only machine, take the CPU wheel — it is far smaller than the default
CUDA build:

```bash
.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python -m pip install ultralytics
```

---

## Every environment variable

| Variable | Required | What it does | Where to get it |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | No | Turns on the two reasoning agents. Without it, rule engines. | <https://console.anthropic.com> |
| `VISION_SERVICE_URL` | No | Points at the Python service. Without it, stage 1 uses the incident model. | `http://127.0.0.1:8000` |

Both go in **`.env.local`** at the project root. It is git-ignored.

There is nothing else to configure. No database, no auth provider, no map API
key — the map is drawn from the zone model, not tiled from a service.

---

## Checking it works

```bash
npm run verify
```

47 checks against the running dev server: every page, both graphs end to end
through both approval gates, the RAG refusal path, the vision service, and the
audit register. Exits non-zero on failure, so it works in CI.

---

## Deploying

**The app** deploys to Vercel as-is — push the repo, set `ANTHROPIC_API_KEY` in
the project's environment variables, done. Do not set `VISION_SERVICE_URL`
unless you have also hosted the Python service somewhere reachable.

**The vision service** needs a container host that allows a ~2 GB image
(Render, Railway, Fly.io — not Vercel, which has no PyTorch runtime). If you
host it, set `VISION_SERVICE_URL` to its public URL. If you do not, the app
degrades cleanly and says so.

For a hackathon demo, running both locally is the right call — the vision
service is the slowest thing to cold-start on a free tier, and a judge watching
a 40-second wake-up is worse than not showing it at all.
