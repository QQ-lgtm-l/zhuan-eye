# 从 PPED(DST1897) 抽 helmet / head 两类头部框，裁成分类数据
# 只读 PPED，写入 D:/workspace/factory/datasets/helmet_cls
import argparse
import hashlib
import random
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\BaiduNetdiskDownload\PPED(DST1897)")
OUT = Path(r"D:\workspace\factory\datasets\helmet_cls")
CLASSES = {0: "helmet", 2: "bare_head"}


def read_boxes(label_path: Path):
    out = []
    if not label_path.exists():
        return out
    for line in label_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        p = line.split()
        if len(p) < 5:
            continue
        cid = int(p[0])
        if cid not in CLASSES:
            continue
        cx, cy, w, h = map(float, p[1:5])
        out.append((CLASSES[cid], cx, cy, w, h))
    return out


def crop_one(img_path: Path, split: str, cls: str, cx, cy, w, h, idx: int, pad: float):
    with Image.open(img_path) as im:
        im = im.convert("RGB")
        W, H = im.size
        x1 = (cx - w / 2) * W
        y1 = (cy - h / 2) * H
        x2 = (cx + w / 2) * W
        y2 = (cy + h / 2) * H
        bw, bh = x2 - x1, y2 - y1
        if bw < 18 or bh < 18:
            return False
        # 头部框稍微扩一点，保留发际线/帽檐
        x1 -= bw * pad
        y1 -= bh * pad
        x2 += bw * pad
        y2 += bh * pad
        x1, y1 = max(0, int(x1)), max(0, int(y1))
        x2, y2 = min(W, int(x2)), min(H, int(y2))
        if x2 - x1 < 18 or y2 - y1 < 18:
            return False
        crop = im.crop((x1, y1, x2, y2))
        dst = OUT / split / cls
        dst.mkdir(parents=True, exist_ok=True)
        crop.save(dst / f"{img_path.stem}_{idx:04d}.jpg", quality=92)
        return True


def collect(split: str, per_class: int, pad: float, seed: int):
    random.seed(seed)
    files = sorted((ROOT / "images" / split).glob("*.jpg"))
    random.shuffle(files)
    counts = {c: 0 for c in CLASSES.values()}
    for img in files:
        if all(counts[c] >= per_class for c in counts):
            break
        label = ROOT / "labels" / split / (img.stem + ".txt")
        for idx, (cls, cx, cy, w, h) in enumerate(read_boxes(label)):
            if counts[cls] >= per_class:
                continue
            if crop_one(img, split if split in ("train", "val") else "val", cls, cx, cy, w, h, idx, pad):
                counts[cls] += 1
    print(split, counts)
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-per-class", type=int, default=3000)
    ap.add_argument("--val-per-class", type=int, default=600)
    ap.add_argument("--pad", type=float, default=0.18)
    args = ap.parse_args()
    # 用 PPED train 抽训练集，valid 抽验证集；test 留作最终盲测，不参与训练
    collect("train", args.train_per_class, args.pad, 20261102)
    collect("valid", args.val_per_class, args.pad, 20261103)
    print("OUT", OUT)


if __name__ == "__main__":
    main()
