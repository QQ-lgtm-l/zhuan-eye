# 用 Construction-PPE 的 Person 框 + helmet/no_helmet 标注，裁“人物头部”分类数据
# 这样训练分布和线上“person 头部裁剪”一致
import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent\datasets")
OUT = Path(r"D:\workspace\factory\datasets\helmet_person_ppe")
HEAD_FRAC = 0.25


def read_boxes(label_path: Path):
    out = []
    if not label_path.exists():
        return out
    for line in label_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        p = line.split()
        if len(p) < 5:
            continue
        cid = int(p[0])
        cx, cy, w, h = map(float, p[1:5])
        out.append((cid, [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]))
    return out


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def collect(split: str):
    counts = {"helmet": 0, "bare_head": 0, "skip": 0}
    for img in sorted((ROOT / "images" / split).glob("*.jpg")):
        boxes = read_boxes(ROOT / "labels" / split / (img.stem + ".txt"))
        persons = [b for c, b in boxes if c == 6]
        hats = [b for c, b in boxes if c == 0]
        nohats = [b for c, b in boxes if c == 7]
        if not persons:
            continue
        with Image.open(img) as im:
            im = im.convert("RGB")
            W, H = im.size
            for i, p in enumerate(persons):
                x1, y1, x2, y2 = p[0] * W, p[1] * H, p[2] * W, p[3] * H
                head = [x1 / W, y1 / H, x2 / W, (y1 + (y2 - y1) * HEAD_FRAC) / H]
                h_hit = any(iou(head, b) > 0.1 for b in hats)
                b_hit = any(iou(head, b) > 0.1 for b in nohats)
                if h_hit and b_hit:
                    counts["skip"] += 1
                    continue
                if not h_hit and not b_hit:
                    counts["skip"] += 1
                    continue
                cls = "helmet" if h_hit else "bare_head"
                crop = im.crop((max(0, int(x1)), max(0, int(y1)), min(W, int(x2)), min(H, int(y1 + (y2 - y1) * HEAD_FRAC))))
                if crop.width < 18 or crop.height < 18:
                    counts["skip"] += 1
                    continue
                dst = OUT / split / cls
                dst.mkdir(parents=True, exist_ok=True)
                crop.save(dst / f"{img.stem}_p{i:03d}.jpg", quality=92)
                counts[cls] += 1
    print(split, counts)


def main():
    ap = argparse.ArgumentParser()
    ap.parse_args()
    collect("train")
    collect("val")
    print("OUT", OUT)


if __name__ == "__main__":
    main()
