# 用房建 Construction-PPE 数据集的 helmet / no_helmet 框，裁头部二分类数据
# 数据集：datasets/data.yaml（helmet=0, no_helmet=7）
import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent\datasets")
OUT = Path(r"D:\workspace\factory\datasets\helmet_cls_ppe")
CLASSES = {0: "helmet", 7: "bare_head"}


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
        x1, y1, x2, y2 = (cx - w / 2) * W, (cy - h / 2) * H, (cx + w / 2) * W, (cy + h / 2) * H
        bw, bh = x2 - x1, y2 - y1
        if bw < 18 or bh < 18:
            return False
        x1, y1 = max(0, int(x1 - bw * pad)), max(0, int(y1 - bh * pad))
        x2, y2 = min(W, int(x2 + bw * pad)), min(H, int(y2 + bh * pad))
        if x2 - x1 < 18 or y2 - y1 < 18:
            return False
        dst = OUT / split / cls
        dst.mkdir(parents=True, exist_ok=True)
        im.crop((x1, y1, x2, y2)).save(dst / f"{img_path.stem}_{idx:04d}.jpg", quality=92)
        return True


def collect(split: str, pad: float):
    counts = {c: 0 for c in CLASSES.values()}
    for img in sorted((ROOT / "images" / split).glob("*.jpg")):
        label = ROOT / "labels" / split / (img.stem + ".txt")
        for idx, (cls, cx, cy, w, h) in enumerate(read_boxes(label)):
            if crop_one(img, split, cls, cx, cy, w, h, idx, pad):
                counts[cls] += 1
    print(split, counts)
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pad", type=float, default=0.15)
    args = ap.parse_args()
    collect("train", args.pad)
    collect("val", args.pad)
    print("OUT", OUT)


if __name__ == "__main__":
    main()
