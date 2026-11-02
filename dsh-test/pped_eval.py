# 用 PPED(DST1897) 的 test 集抽样验证当前 construction_safety.pt
# 只做只读评估，不改模型/数据
import argparse
import random
from collections import defaultdict
from pathlib import Path

import numpy as np
from ultralytics import YOLO

ROOT = Path(r"D:\BaiduNetdiskDownload\PPED(DST1897)")
NAMES = {0: "helmet", 1: "No_vest", 2: "head", 3: "Vest"}
# PPED 类别 -> 当前模型类别
MAP = {
    "helmet": ["hardhat", "helmet"],
    "Vest": ["safety_vest", "vest"],
    "No_vest": ["no_safety_vest", "no-vest"],
}


def load_gt(txt: Path):
    out = []
    for line in txt.read_text(encoding="utf-8", errors="ignore").splitlines():
        p = line.split()
        if len(p) < 5:
            continue
        cid = int(p[0])
        cx, cy, w, h = map(float, p[1:5])
        x1, y1 = (cx - w / 2), (cy - h / 2)
        x2, y2 = (cx + w / 2), (cy + h / 2)
        out.append((NAMES.get(cid, str(cid)), [x1, y1, x2, y2]))
    return out


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    iw, ih = max(0, x2 - x1), max(0, y2 - y1)
    inter = iw * ih
    ua = max(0, a[2] - a[0]) * max(0, a[3] - a[1]) + max(0, b[2] - b[0]) * max(0, b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def eval_one(gt, preds, cls, thr=0.5):
    """gt/preds 都是归一化 [x1,y1,x2,y2]；只匹配指定类别。"""
    g = [b for c, b in gt if c == cls]
    p = [b for c, b in preds if c in MAP.get(cls, [])]
    used = [False] * len(p)
    tp = 0
    for gb in g:
        best, best_iou = -1, 0
        for i, pb in enumerate(p):
            if used[i]:
                continue
            v = iou(gb, pb)
            if v > best_iou:
                best, best_iou = i, v
        if best >= 0 and best_iou >= thr:
            used[best] = True
            tp += 1
    fp = len(p) - tp
    fn = len(g) - tp
    return tp, fp, fn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--imgsz", type=int, default=640)
    args = ap.parse_args()

    imgs = sorted((ROOT / "images" / "test").glob("*.jpg"))
    random.seed(20261102)
    random.shuffle(imgs)
    imgs = imgs[: args.n]

    model = YOLO(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent\weights\construction_safety.pt")
    names = model.names
    stats = defaultdict(lambda: [0, 0, 0])  # tp, fp, fn
    per_image = []

    for idx, img in enumerate(imgs, 1):
        label = ROOT / "labels" / "test" / (img.stem + ".txt")
        gt = load_gt(label) if label.exists() else []
        r = model(str(img), conf=args.conf, imgsz=args.imgsz, augment=False, verbose=False)[0]
        preds = []
        for b in r.boxes:
            cid = int(b.cls[0])
            x1, y1, x2, y2 = map(float, b.xyxy[0])
            preds.append((names[cid], [x1 / r.orig_shape[1], y1 / r.orig_shape[0], x2 / r.orig_shape[1], y2 / r.orig_shape[0]]))
        row = {"image": img.name, "gt": defaultdict(int), "pred": defaultdict(int)}
        for cls in ("helmet", "Vest", "No_vest"):
            tp, fp, fn = eval_one(gt, preds, cls)
            stats[cls][0] += tp
            stats[cls][1] += fp
            stats[cls][2] += fn
            row["gt"][cls] = sum(1 for c, _ in gt if c == cls)
            row["pred"][cls] = sum(1 for c, _ in preds if c in MAP[cls])
        per_image.append(row)
        if idx % 20 == 0:
            print(f"processed {idx}/{len(imgs)}")

    print(f"\nPPED test 抽样 {len(imgs)} 张, conf={args.conf}, imgsz={args.imgsz}, IoU=0.5")
    for cls in ("helmet", "Vest", "No_vest"):
        tp, fp, fn = stats[cls]
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        print(f"{cls:8s} TP={tp:5d} FP={fp:5d} FN={fn:5d} P={precision:.3f} R={recall:.3f} F1={f1:.3f}")

    # 输出几个有 GT 但全漏的图，便于人工看
    misses = [r for r in per_image if r["gt"]["helmet"] > 0 and r["pred"]["helmet"] == 0]
    print(f"\n有 helmet GT 但没检出 hardhat 的图: {len(misses)} 张")
    for r in misses[:10]:
        print(" ", r["image"], "gt_helmet=", r["gt"]["helmet"])


if __name__ == "__main__":
    main()
