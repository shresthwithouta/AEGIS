"""
Train the flood-segmentation U-Net on FloodNet.

Written to run on a free Colab or Kaggle T4 — which is the realistic option,
because the laptop this project was built on has Intel integrated graphics and
no CUDA. On a T4 this reaches usable mean-IoU in roughly two hours.

    python train_unet.py --data /path/to/FloodNet --epochs 40 --batch 8

FloodNet-Supervised_v1.0 (github.com/BinaLab/FloodNet-Supervised_v1.0) ships
UAV imagery from Hurricane Harvey with per-pixel labels. Classes 1 and 3 are
`building-flooded` and `road-flooded`; class 5 is `water`. Everything else is
dry. That mapping is what `--flood-classes` encodes, and it is the one thing to
re-check if you swap datasets — Sen1Floods11 uses a different scheme.
"""

from __future__ import annotations

import argparse
import os
import random
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset

from aegis_vision.unet import DiceBCELoss, UNet, mean_iou

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}


class FloodSegmentationDataset(Dataset):
    """
    Paired image/mask directories. Masks are single-channel class indices;
    `flood_classes` selects which indices count as water.
    """

    def __init__(self, images_dir: Path, masks_dir: Path, size: int, flood_classes: set[int], augment: bool):
        self.images = sorted(p for p in images_dir.iterdir() if p.suffix.lower() in IMAGE_EXT)
        self.masks_dir = masks_dir
        self.size = size
        self.flood_classes = flood_classes
        self.augment = augment

        if not self.images:
            raise SystemExit(f"No images found in {images_dir}")

    def __len__(self) -> int:
        return len(self.images)

    def _mask_for(self, image_path: Path) -> Path:
        for ext in (".png", ".tif", ".jpg"):
            candidate = self.masks_dir / (image_path.stem + ext)
            if candidate.exists():
                return candidate
            candidate = self.masks_dir / (image_path.stem + "_lab" + ext)
            if candidate.exists():
                return candidate
        raise FileNotFoundError(f"No mask for {image_path.name} in {self.masks_dir}")

    def __getitem__(self, idx: int):
        img_path = self.images[idx]
        img = Image.open(img_path).convert("RGB").resize((self.size, self.size), Image.BILINEAR)
        # NEAREST on labels — bilinear would invent class indices that do not exist.
        msk = Image.open(self._mask_for(img_path)).resize((self.size, self.size), Image.NEAREST)

        img_a = np.asarray(img, dtype=np.float32) / 255.0
        msk_a = np.asarray(msk)
        if msk_a.ndim == 3:
            msk_a = msk_a[..., 0]
        water = np.isin(msk_a, list(self.flood_classes)).astype(np.float32)

        if self.augment:
            if random.random() < 0.5:
                img_a, water = img_a[:, ::-1].copy(), water[:, ::-1].copy()
            if random.random() < 0.5:
                img_a, water = img_a[::-1, :].copy(), water[::-1, :].copy()
            k = random.randint(0, 3)
            if k:
                img_a, water = np.rot90(img_a, k).copy(), np.rot90(water, k).copy()
            # Brightness/contrast jitter — flood imagery arrives at every hour
            # and every haze level, and a model tuned to noon light is useless
            # at the times a district actually flies.
            if random.random() < 0.4:
                img_a = np.clip(img_a * random.uniform(0.75, 1.25) + random.uniform(-0.08, 0.08), 0, 1)

        x = torch.from_numpy(img_a).permute(2, 0, 1)
        y = torch.from_numpy(water)[None]
        return x, y


def run_epoch(model, loader, criterion, optimiser, device, train: bool):
    model.train(train)
    total_loss = 0.0
    total_iou = 0.0
    batches = 0

    for x, y in loader:
        x, y = x.to(device), y.to(device)
        with torch.set_grad_enabled(train):
            logits = model(x)
            loss = criterion(logits, y)
            if train:
                optimiser.zero_grad(set_to_none=True)
                loss.backward()
                # Dice can spike early; clipping keeps the first epochs stable.
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimiser.step()
        total_loss += float(loss)
        total_iou += mean_iou(logits, y)
        batches += 1

    return total_loss / max(1, batches), total_iou / max(1, batches)


def main() -> None:
    ap = argparse.ArgumentParser(description="Train the AEGIS flood-segmentation U-Net.")
    ap.add_argument("--data", required=True, help="Dataset root containing train/ and val/")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--base", type=int, default=64, help="U-Net base width; drop to 32 if VRAM is tight")
    ap.add_argument("--out", default="weights/unet_floodnet.pt")
    ap.add_argument(
        "--flood-classes",
        default="1,3,5",
        help="Mask indices that count as water. FloodNet default: 1 building-flooded, 3 road-flooded, 5 water.",
    )
    args = ap.parse_args()

    root = Path(args.data)
    flood_classes = {int(c) for c in args.flood_classes.split(",")}
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if device.type == "cpu":
        print(
            "WARNING: training on CPU. This is hours-to-days rather than hours.\n"
            "         Use a Colab or Kaggle T4, or reduce --size and --base."
        )

    train_ds = FloodSegmentationDataset(
        root / "train" / "images", root / "train" / "masks", args.size, flood_classes, augment=True
    )
    val_ds = FloodSegmentationDataset(
        root / "val" / "images", root / "val" / "masks", args.size, flood_classes, augment=False
    )

    train_dl = DataLoader(train_ds, batch_size=args.batch, shuffle=True, num_workers=2, pin_memory=True, drop_last=True)
    val_dl = DataLoader(val_ds, batch_size=args.batch, shuffle=False, num_workers=2, pin_memory=True)

    model = UNet(3, 1, base=args.base).to(device)
    criterion = DiceBCELoss()
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, T_max=args.epochs)

    params = sum(p.numel() for p in model.parameters()) / 1e6
    print(f"U-Net base={args.base} · {params:.1f}M params · {len(train_ds)} train / {len(val_ds)} val · {device}")

    os.makedirs(Path(args.out).parent, exist_ok=True)
    best_iou = 0.0

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss, train_iou = run_epoch(model, train_dl, criterion, optimiser, device, train=True)
        val_loss, val_iou = run_epoch(model, val_dl, criterion, optimiser, device, train=False)
        scheduler.step()

        marker = ""
        if val_iou > best_iou:
            best_iou = val_iou
            torch.save(
                {
                    "model": model.state_dict(),
                    "base": args.base,
                    "size": args.size,
                    "val_iou": val_iou,
                    "epoch": epoch,
                    "flood_classes": sorted(flood_classes),
                },
                args.out,
            )
            marker = "  <- saved"

        print(
            f"epoch {epoch:3d}/{args.epochs}  "
            f"train loss {train_loss:.4f} iou {train_iou:.4f}  |  "
            f"val loss {val_loss:.4f} iou {val_iou:.4f}  "
            f"({time.time() - t0:.0f}s){marker}"
        )

    print(f"\nBest validation mean-IoU: {best_iou:.4f}")
    print(f"Weights: {args.out}")
    print("\nReport this number honestly. Published FloodNet baselines sit in the 0.70-0.80 mean-IoU")
    print("range; if yours is well below that, say so rather than citing someone else's figure.")


if __name__ == "__main__":
    main()
