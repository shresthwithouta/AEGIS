"""
AEGIS vision service.

Stage 1 of the pipeline, as a standalone FastAPI service. The command centre
calls it when VISION_SERVICE_URL is set and falls back to its own incident model
when it is not, so the two deploy independently — which they have to, because
PyTorch does not run where the Next.js app runs.

Contract: POST an image, get back the 100-zone record the pipeline already
consumes, plus a provenance block saying which model produced each field and
what is missing. The provenance block is not optional decoration — it is how the
command centre knows whether to label a figure REAL or SIMULATED on screen.

Run:
    pip install -r requirements.txt
    uvicorn app:app --reload --port 8000
"""

from __future__ import annotations

import io
import logging
import os
import time
from typing import Any

import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from aegis_vision.detection import load_detector
from aegis_vision.gridding import grid_observations, summarise
from aegis_vision.segmentation import load_segmenter

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("aegis.vision")

UNET_WEIGHTS = os.getenv("AEGIS_UNET_WEIGHTS", "weights/unet_floodnet.pt")
YOLO_WEIGHTS = os.getenv("AEGIS_YOLO_WEIGHTS", "yolov8n.pt")
DAMAGE_WEIGHTS = os.getenv("AEGIS_DAMAGE_WEIGHTS")  # xBD-trained; usually absent
DEVICE = os.getenv("AEGIS_DEVICE", "cpu")
MAX_EDGE = int(os.getenv("AEGIS_MAX_EDGE", "1600"))

app = FastAPI(
    title="AEGIS Vision Service",
    version="1.0.0",
    description="Flood segmentation and object detection for the AEGIS disaster-response pipeline.",
)

# The command centre is the only intended caller; a deployment pins this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("AEGIS_ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

SEGMENTER = None
DETECTOR = None


@app.on_event("startup")
def _load_models() -> None:
    global SEGMENTER, DETECTOR
    t0 = time.time()
    SEGMENTER = load_segmenter(UNET_WEIGHTS)
    DETECTOR = load_detector(YOLO_WEIGHTS, device=DEVICE)
    log.info(
        "Models ready in %.1fs — segmentation=%s detection=%s",
        time.time() - t0,
        SEGMENTER.method,
        getattr(DETECTOR, "model_name", "none"),
    )


@app.get("/health")
def health() -> dict[str, Any]:
    """
    What this service can actually do right now.

    The command centre reads this on startup to decide whether stage 1 is REAL
    or SIMULATED, and what to print next to each figure.
    """
    seg_method = getattr(SEGMENTER, "method", "unavailable")
    det_available = getattr(DETECTOR, "model_name", "none") != "none"

    return {
        "status": "ok",
        "device": DEVICE,
        "segmentation": {
            "method": seg_method,
            "model": getattr(SEGMENTER, "model_name", None),
            "trained": seg_method == "unet",
            "note": (
                "Trained U-Net."
                if seg_method == "unet"
                else "Classical water index — real method, lower ceiling than a trained U-Net. "
                "Run train_unet.py against FloodNet to upgrade."
            ),
        },
        "detection": {
            "model": getattr(DETECTOR, "model_name", "none"),
            "available": det_available,
            "note": (
                "Pretrained COCO detection — person, animal and vehicle counts are real."
                if det_available
                else "Detector not installed; counts unavailable."
            ),
        },
        "damage_classification": {
            "available": bool(DAMAGE_WEIGHTS),
            "note": (
                "xBD-trained damage classifier loaded."
                if DAMAGE_WEIGHTS
                else "No damage model. Damage is reported as null, not zero — an unmodelled "
                "quantity must not travel downstream looking like a measurement."
            ),
        },
    }


def _read_image(data: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc

    # Cap the long edge. A 12,000 px orthomosaic on CPU is a request that never
    # returns, and the zone grid does not benefit from the extra resolution.
    if max(img.size) > MAX_EDGE:
        scale = MAX_EDGE / max(img.size)
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.BILINEAR)

    return np.asarray(img)


@app.post("/analyse")
async def analyse(
    image: UploadFile = File(..., description="Satellite or UAV frame of the area of interest"),
    grid: int = Query(10, ge=2, le=20, description="Grid resolution per side"),
    imgsz: int = Query(640, ge=320, le=1280, description="Detector input size"),
) -> dict[str, Any]:
    """Run stage 1 over one frame and return the per-zone record."""
    if SEGMENTER is None or DETECTOR is None:
        raise HTTPException(status_code=503, detail="Models still loading")

    started = time.time()
    frame = _read_image(await image.read())

    seg = SEGMENTER.segment(frame)
    det = DETECTOR.detect(frame, imgsz=imgsz)

    zones = grid_observations(
        image=frame,
        water_mask=seg.mask,
        detections=det.detections,
        grid=grid,
        seg_confidence=seg.confidence,
        damage_available=bool(DAMAGE_WEIGHTS),
    )

    return {
        "zones": zones,
        "summary": summarise(zones),
        "provenance": {
            "segmentation": {
                "method": seg.method,
                "model": seg.model_name,
                "confidence": seg.confidence,
                "trained": seg.method == "unet",
                "notes": seg.notes,
            },
            "detection": {
                "model": det.model_name,
                "available": det.available,
                "counts": det.counts,
                "notes": det.notes,
            },
            "damage": {
                "available": bool(DAMAGE_WEIGHTS),
                "notes": (
                    "Damage classified by an xBD-trained model."
                    if DAMAGE_WEIGHTS
                    else "No damage model loaded; damage fields are null. The command centre "
                    "must not substitute zero."
                ),
            },
            "depth": {
                "available": False,
                "notes": "Water depth is not inferable from a single RGB frame. Requires a DEM or SAR product.",
            },
        },
        "image": {"width": int(frame.shape[1]), "height": int(frame.shape[0])},
        "elapsed_ms": int((time.time() - started) * 1000),
    }


@app.post("/segment")
async def segment_only(image: UploadFile = File(...)) -> dict[str, Any]:
    """Water mask only — useful for eyeballing the segmenter on a sample image."""
    if SEGMENTER is None:
        raise HTTPException(status_code=503, detail="Models still loading")

    frame = _read_image(await image.read())
    seg = SEGMENTER.segment(frame)

    return {
        "coverage": round(float(seg.mask.mean()), 4),
        "method": seg.method,
        "model": seg.model_name,
        "confidence": seg.confidence,
        "notes": seg.notes,
        "shape": [int(seg.mask.shape[0]), int(seg.mask.shape[1])],
    }
