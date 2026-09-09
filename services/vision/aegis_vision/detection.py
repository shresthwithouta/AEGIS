"""
Object and damage detection.

YOLOv8 via Ultralytics. Two things it does for AEGIS:

  1. Drone intelligence (stage 3). Counting people, animals and vehicles in a
     UAV frame. This needs no training at all — the COCO classes YOLOv8 ships
     with already cover `person`, `car`, `truck`, `bus`, `boat`, `cow`, `dog`,
     `horse`, `sheep`. Pretrained weights download once and run on CPU.

  2. Structural damage (stage 1). This DOES need training, on xBD. Without a
     damage checkpoint the service reports damage as unavailable rather than
     inventing it — an unmodelled quantity is not a zero.

The split matters when someone asks what is real: victim counting is real today
on any machine; damage classification is real only once xBD training has run.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import numpy as np

log = logging.getLogger("aegis.detection")

# COCO classes that mean something to a flood-rescue operator, grouped the way
# the pipeline's victim estimate consumes them.
PERSON_CLASSES = {"person"}
ANIMAL_CLASSES = {"cow", "dog", "horse", "sheep", "bird", "cat", "elephant", "bear", "zebra", "giraffe"}
VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle", "bicycle", "boat", "train", "airplane"}


@dataclass
class Detection:
    label: str
    confidence: float
    box: tuple[float, float, float, float]  # x1, y1, x2, y2 in pixels
    category: str  # person | animal | vehicle | other


@dataclass
class DetectionResult:
    detections: list[Detection] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)
    model_name: str = "none"
    available: bool = False
    notes: str = ""


def categorise(label: str) -> str:
    if label in PERSON_CLASSES:
        return "person"
    if label in ANIMAL_CLASSES:
        return "animal"
    if label in VEHICLE_CLASSES:
        return "vehicle"
    return "other"


class YoloDetector:
    """
    Wraps an Ultralytics YOLO model.

    `weights` may be a pretrained name such as "yolov8n.pt" (downloaded on first
    use) or a path to a checkpoint fine-tuned on xBD for damage classes.
    """

    def __init__(self, weights: str = "yolov8n.pt", conf: float = 0.25, device: str = "cpu"):
        from ultralytics import YOLO  # lazy — the service starts without it

        self.model = YOLO(weights)
        self.model_name = os.path.basename(weights)
        self.conf = conf
        self.device = device
        log.info("YOLO loaded: %s on %s", self.model_name, device)

    def detect(self, image: np.ndarray, imgsz: int = 640) -> DetectionResult:
        results = self.model.predict(
            source=image,
            conf=self.conf,
            imgsz=imgsz,
            device=self.device,
            verbose=False,
        )

        detections: list[Detection] = []
        counts = {"person": 0, "animal": 0, "vehicle": 0, "other": 0}

        for res in results:
            names: dict[int, str] = res.names
            if res.boxes is None:
                continue
            for box in res.boxes:
                label = names[int(box.cls[0])]
                category = categorise(label)
                x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
                detections.append(
                    Detection(
                        label=label,
                        confidence=round(float(box.conf[0]), 3),
                        box=(x1, y1, x2, y2),
                        category=category,
                    )
                )
                counts[category] += 1

        return DetectionResult(
            detections=detections,
            counts=counts,
            model_name=self.model_name,
            available=True,
            notes=(
                "Pretrained COCO classes. Person, animal and vehicle counts are real detections; "
                "structural damage classes require a checkpoint fine-tuned on xBD."
            ),
        )


class NullDetector:
    """
    What the service uses when Ultralytics is not installed.

    Deliberately returns `available=False` with zero detections rather than a
    plausible-looking guess. A count nobody measured must not travel downstream
    into a resource allocation looking like one that was.
    """

    model_name = "none"

    def detect(self, image: np.ndarray, imgsz: int = 640) -> DetectionResult:
        return DetectionResult(
            detections=[],
            counts={"person": 0, "animal": 0, "vehicle": 0, "other": 0},
            model_name="none",
            available=False,
            notes="Detector not installed. Counts are unavailable, not zero — install ultralytics to enable.",
        )


def load_detector(weights: str | None, device: str = "cpu") -> Any:
    try:
        return YoloDetector(weights or "yolov8n.pt", device=device)
    except Exception as exc:
        log.warning("YOLO unavailable (%s) — detection disabled", exc)
        return NullDetector()
