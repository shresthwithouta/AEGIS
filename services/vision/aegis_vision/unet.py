"""
U-Net (Ronneberger, Fischer & Brox, 2015) — arxiv.org/abs/1505.04597.

Encoder-decoder with skip connections, which is what makes it right for flood
extent: the decoder recovers the boundary detail the encoder pooled away, and a
flood mask is mostly boundary. Four downsampling stages, batch norm added
(the 2015 paper predates its common use), transposed-conv upsampling.

Kept small on purpose — 31M parameters at base=64 trains on a single free-tier
Colab or Kaggle GPU in a couple of hours on FloodNet, which is the realistic
budget for this project.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class DoubleConv(nn.Module):
    """(conv 3x3 → BN → ReLU) × 2 — the repeating unit of both paths."""

    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class UNet(nn.Module):
    def __init__(self, in_channels: int = 3, out_channels: int = 1, base: int = 64):
        super().__init__()
        b = base

        self.enc1 = DoubleConv(in_channels, b)
        self.enc2 = DoubleConv(b, b * 2)
        self.enc3 = DoubleConv(b * 2, b * 4)
        self.enc4 = DoubleConv(b * 4, b * 8)
        self.pool = nn.MaxPool2d(2)

        self.bottleneck = DoubleConv(b * 8, b * 16)

        self.up4 = nn.ConvTranspose2d(b * 16, b * 8, kernel_size=2, stride=2)
        self.dec4 = DoubleConv(b * 16, b * 8)
        self.up3 = nn.ConvTranspose2d(b * 8, b * 4, kernel_size=2, stride=2)
        self.dec3 = DoubleConv(b * 8, b * 4)
        self.up2 = nn.ConvTranspose2d(b * 4, b * 2, kernel_size=2, stride=2)
        self.dec2 = DoubleConv(b * 4, b * 2)
        self.up1 = nn.ConvTranspose2d(b * 2, b, kernel_size=2, stride=2)
        self.dec1 = DoubleConv(b * 2, b)

        self.head = nn.Conv2d(b, out_channels, kernel_size=1)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))

        bottleneck = self.bottleneck(self.pool(e4))

        d4 = self.dec4(torch.cat([self.up4(bottleneck), e4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))

        return self.head(d1)  # logits — apply sigmoid at inference


class DiceBCELoss(nn.Module):
    """
    Dice + BCE.

    Flood masks are heavily imbalanced — most pixels are not water — and plain
    BCE learns to predict "dry everywhere" and score well doing it. Dice scores
    overlap, which is what mean-IoU will measure, so optimising a mix of the two
    trains against the metric the result is actually judged on.
    """

    def __init__(self, dice_weight: float = 0.5, smooth: float = 1.0):
        super().__init__()
        self.bce = nn.BCEWithLogitsLoss()
        self.dice_weight = dice_weight
        self.smooth = smooth

    def forward(self, logits, targets):
        bce = self.bce(logits, targets)
        probs = torch.sigmoid(logits)
        num = 2.0 * (probs * targets).sum(dim=(1, 2, 3)) + self.smooth
        den = probs.sum(dim=(1, 2, 3)) + targets.sum(dim=(1, 2, 3)) + self.smooth
        dice = 1.0 - (num / den).mean()
        return (1.0 - self.dice_weight) * bce + self.dice_weight * dice


@torch.no_grad()
def mean_iou(logits, targets, threshold: float = 0.5) -> float:
    """Mean IoU over the batch — the figure FloodNet results are reported in."""
    preds = (torch.sigmoid(logits) > threshold).float()
    inter = (preds * targets).sum(dim=(1, 2, 3))
    union = ((preds + targets) >= 1).float().sum(dim=(1, 2, 3))
    iou = (inter + 1e-6) / (union + 1e-6)
    return float(iou.mean())
