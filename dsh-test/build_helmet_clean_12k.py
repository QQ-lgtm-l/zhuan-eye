# 清洗 12000 张混合数据集：只取 ds4(10类) + ds5(11类)，按各自类别 ID 重映射
# 输出 helmet / bare_head 头部裁剪；排除 ds1/ds2 的拼接/旋转图
import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\BaiduNetdiskDownload\源文件\工地安全护具检测数据集\PPE_Final_Dataset")
OUT = Path(r"D:\workspace\factory\datasets\helmet_clean_12k")
# ds4 为 10 类：0 helmet, 6 no_helmet
# ds5 为 11 类：0 helmet, 7 no_helmet
MAP = {"ds4": {0: "helmet", 6: "bare_head"}, "ds5": {0: "helmet", 7: "bare_head"}}


def read_boxes(label_path: Path, prefix: str):
    out = []
    if not label_path.exists():
        return out
    mapping = MAP.get(prefix, {})
    for line in label_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        p = line.split()
        if len(p) < 5:
            continue
        cid = int(p[0])
        if cid not in mapping:
            continue
        cx, cy, w, h = map(float, p[1:5])
        out.append((mapping[cid], cx, cy, w, h))
    return out


def crop_one(img_path: Path, cls: str, cx, cy, w, h, idx: int, pad: float):
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
        dst = OUT / "train" if "train" in str(img_path.parent).replace("\\", "/") else OUT / "val"
        dst = dst / cls
        dst.mkdir(parents=True, exist_ok=True)
        im.crop((x1, y1, x2, y2)).save(dst / f"{img_path.stem}_{idx:04d}.jpg", quality=92)
        return True


def collect(split: str, cap_per_class: int, pad: float):
    counts = {"helmet": 0, "bare_head": 0}
    for prefix in ("ds4", "ds5"):
        for img in sorted((ROOT / split / "images").glob(f"{prefix}__*.jpg")):
            label = ROOT / split / "labels" / (img.stem + ".txt")
            for idx, (cls, cx, cy, w, h) in enumerate(read_boxes(label, prefix)):
                if counts[cls] >= cap_per_class:
                    continue
                if crop_one(img, cls, cx, cy, w, h, idx, pad):
                    counts[cls] += 1
    print(split, counts)
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-per-class", type=int, default=2000)
    ap.add_argument("--val-per-class", type=int, default=300)
    ap.add_argument("--pad", type=float, default=0.12)
    args = ap.parse_args()
    collect("train", args.train_per_class, args.pad)
    collect("val", args.val_per_class, args.pad)
    print("OUT", OUT)


if __name__ == "__main__":
    main()
