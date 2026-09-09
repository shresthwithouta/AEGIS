"""
Turning pixels into the 100-zone grid.

This is the seam between computer vision and everything downstream. The command
centre reasons over zones, not pixels, so the service's contract is: give it an
image, get back exactly the per-zone record `buildZones` produces synthetically
— same field names, same ranges — so the pipeline cannot tell which produced it.

Depth is the one field that cannot be inferred from a single RGB frame. It is
returned as null with a stated reason rather than estimated from colour, which
would be a fabricated number feeding a boat count.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import numpy as np

COLUMNS = "ABCDEFGHIJ"


def zone_id(col: int, row: int) -> str:
    return f"{COLUMNS[col]}-{row + 1:02d}"


@dataclass
class ZoneObservation:
    id: str
    col: int
    row: int
    flood: float           # 0-1, share of zone classified as water
    damage: float | None   # 0-1, or None when no damage model is loaded
    damaged_structures: int | None
    persons: int
    animals: int
    vehicles: int
    detection_confidence: float
    segmentation_confidence: float
    depth_m: None          # not inferable from a single RGB frame
    depth_note: str


def grid_observations(
    image: np.ndarray,
    water_mask: np.ndarray,
    detections: list,
    grid: int = 10,
    seg_confidence: float = 0.5,
    damage_available: bool = False,
) -> list[dict[str, Any]]:
    """
    Split the frame into `grid` x `grid` cells and summarise each.

    Detections are assigned to the cell containing the *bottom centre* of their
    box — the ground contact point — not the box centre. For an oblique aerial
    frame a tall subject's box centre can sit a cell away from where the subject
    is actually standing, which would put a person in the wrong zone and send a
    boat to the wrong grid reference.
    """
    h, w = water_mask.shape[:2]
    cell_h = h / grid
    cell_w = w / grid

    counts = [[{"person": 0, "animal": 0, "vehicle": 0} for _ in range(grid)] for _ in range(grid)]
    conf_sum = [[0.0 for _ in range(grid)] for _ in range(grid)]
    conf_n = [[0 for _ in range(grid)] for _ in range(grid)]

    for det in detections:
        x1, y1, x2, y2 = det.box
        gx = (x1 + x2) / 2.0
        gy = y2  # ground contact
        col = min(grid - 1, max(0, int(gx // cell_w)))
        row = min(grid - 1, max(0, int(gy // cell_h)))
        if det.category in counts[row][col]:
            counts[row][col][det.category] += 1
            conf_sum[row][col] += det.confidence
            conf_n[row][col] += 1

    out: list[dict[str, Any]] = []
    for row in range(grid):
        for col in range(grid):
            y0, y1 = int(row * cell_h), int((row + 1) * cell_h)
            x0, x1 = int(col * cell_w), int((col + 1) * cell_w)
            cell = water_mask[y0:y1, x0:x1]
            flood = float(cell.mean()) if cell.size else 0.0

            c = counts[row][col]
            n = conf_n[row][col]

            obs = ZoneObservation(
                id=zone_id(col, row),
                col=col,
                row=row,
                flood=round(flood, 3),
                damage=None if not damage_available else 0.0,
                damaged_structures=None if not damage_available else 0,
                persons=c["person"],
                animals=c["animal"],
                vehicles=c["vehicle"],
                detection_confidence=round(conf_sum[row][col] / n, 3) if n else 0.0,
                segmentation_confidence=round(seg_confidence, 3),
                depth_m=None,
                depth_note=(
                    "Not inferable from a single RGB frame. A depth figure requires a DEM "
                    "differenced against the water surface, or a stereo/SAR product."
                ),
            )
            out.append(asdict(obs))

    return out


def summarise(zones: list[dict[str, Any]]) -> dict[str, Any]:
    floods = [z["flood"] for z in zones]
    return {
        "zones": len(zones),
        "flooded_zones": sum(1 for f in floods if f > 0.3),
        "mean_flood": round(float(np.mean(floods)), 3) if floods else 0.0,
        "max_flood": round(float(np.max(floods)), 3) if floods else 0.0,
        "persons": sum(z["persons"] for z in zones),
        "animals": sum(z["animals"] for z in zones),
        "vehicles": sum(z["vehicles"] for z in zones),
    }
