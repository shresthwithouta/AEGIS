"""
Flood segmentation.

Two implementations behind one interface, chosen at load time:

  UNetSegmenter      A real U-Net (Ronneberger et al., 2015). Used when trained
                     weights are present. Train with `train_unet.py` against
                     FloodNet or Sen1Floods11.

  SpectralSegmenter  A classical water-index baseline that needs no weights and
                     no GPU. Not a stub — it is a real, citable method, and it
                     runs on the machine you have today.

The baseline exists because the honest state of most hackathon builds is "we
have no trained weights yet", and the alternatives are to fake the output or to
have no output. A published classical method is neither. Its accuracy ceiling is
lower than a trained U-Net's and the service says so in every response.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Literal

import numpy as np

log = logging.getLogger("aegis.segmentation")

# Below this Otsu separability, the water/land split is not describing a real
# boundary in the image. See the calibration note in SpectralSegmenter.segment.
WEAK_SEPARATION = 0.75


@dataclass
class SegmentationResult:
    """A water mask plus an honest account of where it came from."""

    mask: np.ndarray  # bool, HxW — True where water
    method: Literal["unet", "spectral"]
    model_name: str
    confidence: float  # calibration hint, not a per-pixel probability
    notes: str


# --------------------------------------------------------------------------
# Classical baseline
# --------------------------------------------------------------------------


class SpectralSegmenter:
    """
    Water detection by spectral index on RGB imagery.

    Floodwater in aerial RGB is characteristically low-saturation, low-value and
    blue/green dominant relative to soil and vegetation. This computes a
    normalised difference between the blue and red channels — the RGB-only
    analogue of NDWI, which needs a NIR band aerial RGB does not carry — then
    thresholds it with Otsu and cleans up with morphology.

    Known failure modes, stated because they matter operationally:
      * Shadow under cloud or buildings reads as water.
      * Wet tarmac and dark roofs read as water.
      * Turbid floodwater carrying silt (which is what Kosi-basin flood water
        actually looks like) reads weakly and is under-detected.
    A trained U-Net fixes all three. This is the floor, not the target.
    """

    method = "spectral"
    model_name = "NDWI-analogue + Otsu"

    def segment(self, image: np.ndarray) -> SegmentationResult:
        img = image.astype(np.float32) / 255.0
        r, g, b = img[..., 0], img[..., 1], img[..., 2]

        # Water: blue/green dominant over red.
        denom = (g + r) + 1e-6
        index = (g - r) / denom
        index += (b - r) / ((b + r) + 1e-6)
        index /= 2.0

        # Low-value, low-saturation regions reinforce the water signal.
        value = img.max(axis=-1)
        chroma = img.max(axis=-1) - img.min(axis=-1)
        darkish = np.clip(1.0 - value, 0.0, 1.0)
        flat = np.clip(1.0 - chroma * 3.0, 0.0, 1.0)

        score = 0.55 * _normalise(index) + 0.25 * darkish + 0.20 * flat
        threshold, separability = _otsu(score, with_separability=True)
        mask = score > threshold

        mask = _open_close(mask, iterations=2)
        coverage = float(mask.mean())

        # A mask covering almost everything or almost nothing is usually the
        # threshold failing, not a real observation.
        degenerate = coverage > 0.92 or coverage < 0.005

        # Otsu's own goodness-of-fit: how much of the score's variance the split
        # actually explains. On a genuinely bimodal scene — water against land —
        # this is high. On a scene with no water in it at all, the threshold
        # still cuts *somewhere*, and this is what reveals that the cut is
        # arbitrary. Without it the service reported 70% inundation on a
        # photograph of a dry street with the same confidence as a real flood.
        #
        # The cut-off is calibrated, not guessed: measured η was 0.92 on a
        # bimodal flood scene, 1.00 on clean two-tone, 0.87 on low-contrast
        # silty water, against 0.60 on a street photograph with no water and
        # 0.68 on uniform dry land. WEAK_SEPARATION sits in that gap.
        #
        # It is a five-sample calibration on mostly synthetic imagery, so treat
        # it as a smoke alarm rather than a measurement — it is here to stop the
        # service reporting a confident flood fraction for a scene containing no
        # flood, which is the failure that would actually mislead an officer.
        weak = separability < WEAK_SEPARATION

        confidence = 0.58
        if weak:
            confidence = 0.30
        if degenerate:
            confidence = min(confidence, 0.42)

        notes = (
            "Classical water index — no trained weights loaded. Shadow and wet tarmac "
            "are known false positives; silt-laden floodwater is under-detected. "
            "Train a U-Net for operational use."
        )
        if weak:
            notes += (
                f" WEAK SEPARATION (η={separability:.2f}): this image is not clearly "
                "bimodal, so the water/land split is close to arbitrary. Treat the "
                "flood fractions as unreliable rather than as a low reading."
            )
        if degenerate:
            notes += " Threshold looks degenerate — the mask covers almost all or almost none of the frame."

        return SegmentationResult(
            mask=mask,
            method="spectral",
            model_name=self.model_name,
            confidence=confidence,
            notes=notes,
        )


def _normalise(a: np.ndarray) -> np.ndarray:
    lo, hi = float(np.percentile(a, 2)), float(np.percentile(a, 98))
    if hi - lo < 1e-6:
        return np.zeros_like(a)
    return np.clip((a - lo) / (hi - lo), 0.0, 1.0)


def _otsu(a: np.ndarray, bins: int = 256, with_separability: bool = False):
    """
    Otsu's threshold. Pure numpy, so the baseline has no OpenCV dependency.

    One subtlety that matters more than it looks. On cleanly separated data —
    two tight peaks with empty space between them — the between-class variance
    is *identical* for every threshold in that empty span, so it forms a
    plateau rather than a peak. `argmax` returns the first index of a plateau,
    which puts the threshold hard against the lower class and classifies
    everything as foreground.

    Noisy imagery hides this, because noise smears the peaks and creates a
    genuine maximum. It surfaces on exactly the clean inputs a flood pipeline
    will meet: a thresholded SAR product, a rendered map, a re-encoded
    screenshot. So take the centre of the plateau, and return the bin centre
    rather than its left edge.
    """
    hist, edges = np.histogram(a, bins=bins, range=(0.0, 1.0))
    hist = hist.astype(np.float64)
    total = hist.sum()
    if total == 0:
        return (0.5, 0.0) if with_separability else 0.5

    p = hist / total
    omega = np.cumsum(p)
    mu = np.cumsum(p * np.arange(bins))
    mu_t = mu[-1]

    denom = omega * (1.0 - omega)
    valid = denom > 1e-12
    sigma_b = np.zeros(bins, dtype=np.float64)
    sigma_b[valid] = (mu_t * omega[valid] - mu[valid]) ** 2 / denom[valid]

    peak = float(sigma_b.max())
    if peak <= 0.0:
        return (0.5, 0.0) if with_separability else 0.5

    # Every threshold within a whisker of the maximum is equally good; the
    # middle of that run is the one that sits between the classes.
    plateau = np.flatnonzero(sigma_b >= peak * (1.0 - 1e-9))
    idx = int(round(float(plateau.mean())))

    width = edges[1] - edges[0]
    threshold = float(edges[idx] + width / 2.0)

    if not with_separability:
        return threshold

    # Otsu's separability metric: between-class variance over total variance.
    # 1.0 is a perfectly bimodal scene; near 0 means the split explains nothing.
    levels = np.arange(bins)
    sigma_t = float(((levels - mu_t) ** 2 * p).sum())
    separability = 0.0 if sigma_t <= 0 else float(peak / sigma_t)
    return threshold, min(1.0, max(0.0, separability))


def _open_close(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    """Binary opening then closing on a 3x3 cross, via numpy shifts."""
    m = mask
    for _ in range(iterations):
        m = _erode(m)
    for _ in range(iterations * 2):
        m = _dilate(m)
    for _ in range(iterations):
        m = _erode(m)
    return m


def _neighbours(m: np.ndarray):
    pad = np.pad(m, 1, mode="edge")
    return [
        pad[1:-1, 1:-1],
        pad[:-2, 1:-1],
        pad[2:, 1:-1],
        pad[1:-1, :-2],
        pad[1:-1, 2:],
    ]


def _erode(m: np.ndarray) -> np.ndarray:
    return np.logical_and.reduce(_neighbours(m))


def _dilate(m: np.ndarray) -> np.ndarray:
    return np.logical_or.reduce(_neighbours(m))


# --------------------------------------------------------------------------
# U-Net
# --------------------------------------------------------------------------


class UNetSegmenter:
    """
    U-Net inference. Constructed only when torch is importable and a checkpoint
    exists; the service falls back to the spectral baseline otherwise.
    """

    method = "unet"

    def __init__(self, weights_path: str, device: str | None = None):
        import torch  # imported lazily so the service runs without torch

        from .unet import UNet

        self.torch = torch
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.model = UNet(in_channels=3, out_channels=1)
        state = torch.load(weights_path, map_location=self.device)
        self.model.load_state_dict(state.get("model", state))
        self.model.to(self.device).eval()
        self.model_name = os.path.basename(weights_path)
        log.info("U-Net loaded from %s on %s", weights_path, self.device)

    def segment(self, image: np.ndarray) -> SegmentationResult:
        torch = self.torch
        h, w = image.shape[:2]

        # Pad to a multiple of 16 so the four downsamples are exact.
        ph = (16 - h % 16) % 16
        pw = (16 - w % 16) % 16
        padded = np.pad(image, ((0, ph), (0, pw), (0, 0)), mode="reflect")

        x = torch.from_numpy(padded.astype(np.float32) / 255.0).permute(2, 0, 1)[None]
        x = x.to(self.device)

        with torch.no_grad():
            logits = self.model(x)
            prob = torch.sigmoid(logits)[0, 0].cpu().numpy()

        prob = prob[:h, :w]
        mask = prob > 0.5

        # Mean margin from the decision boundary — a usable calibration hint.
        margin = float(np.abs(prob - 0.5).mean() * 2.0)

        return SegmentationResult(
            mask=mask,
            method="unet",
            model_name=self.model_name,
            confidence=round(min(0.97, 0.6 + margin * 0.4), 3),
            notes="U-Net inference on trained weights.",
        )


def load_segmenter(weights_path: str | None) -> SpectralSegmenter | UNetSegmenter:
    """Prefer a trained U-Net; fall back to the classical baseline, loudly."""
    if weights_path and os.path.exists(weights_path):
        try:
            return UNetSegmenter(weights_path)
        except Exception as exc:  # torch missing, bad checkpoint, no memory
            log.warning("U-Net unavailable (%s) — using the spectral baseline", exc)
    else:
        log.warning(
            "No U-Net weights at %r — using the spectral baseline. "
            "Run train_unet.py to produce weights.",
            weights_path,
        )
    return SpectralSegmenter()
