# 离线评估 helmet_cls 在房建 test 集上的 person 级判断
# 依赖：construction_safety.pt + runs/helmet/helmet_cls/weights/best.pt
import os
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

ROOT = Path(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent")
IMAGES = ROOT / "datasets" / "construction-site-safety" / "images" / "test"
LABELS = ROOT / "datasets" / "construction-site-safety" / "labels" / "test"
DET = YOLO(str(ROOT / "weights" / "construction_safety.pt"))
CLS_PATH = os.environ.get("HELMET_CLS", r"D:\workspace\factory\runs\helmet\helmet_cls\weights\best.pt")
CLS = YOLO(CLS_PATH)
NAMES = DET.names
HEAD_FRAC = 0.25


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def load_gt(path: Path, W, H):
    out = []
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        p = line.split()
        if len(p) < 5:
            continue
        cid = int(p[0])
        cx, cy, w, h = map(float, p[1:5])
        out.append((NAMES.get(cid, str(cid)), [(cx - w / 2) * W, (cy - h / 2) * H, (cx + w / 2) * W, (cy + h / 2) * H]))
    return out


def main():
    conf = {"helmet": 0, "bare": 0, "unknown": 0}
    for img_path in sorted(IMAGES.glob("*")):
        if img_path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        im = Image.open(img_path).convert("RGB")
        W, H = im.size
        gt = load_gt(LABELS / (img_path.stem + ".txt"), W, H)
        persons = [b for c, b in gt if c == "person"]
        hats = [b for c, b in gt if c == "hardhat"]
        nohats = [b for c, b in gt if c == "no-hardhat"]
        for b in persons:
            x1, y1, x2, y2 = b
            head = [x1, y1, x2, y1 + (y2 - y1) * HEAD_FRAC]
            is_helmet = any(iou(head, hb) > 0.1 for hb in hats)
            is_bare = any(iou(head, nb) > 0.1 for nb in nohats)
            if not is_helmet and not is_bare:
                continue
            crop = im.crop((max(0, int(x1)), max(0, int(y1)), min(W, int(x2)), min(H, int(y1 + (y2 - y1) * HEAD_FRAC))))
            if crop.width < 10 or crop.height < 10:
                continue
            p = CLS(crop, imgsz=224, verbose=False)[0]
            pred = p.names[int(p.probs.top1)]
            truth = "helmet" if is_helmet else "bare"
            conf[(truth, pred)] = conf.get((truth, pred), 0) + 1
    # print metrics
    labels = ("helmet", "bare_head")
    tp_helmet = conf.get(("helmet", "helmet"), 0)
    fn_helmet = conf.get(("helmet", "bare_head"), 0)
    tp_bare = conf.get(("bare", "bare_head"), 0)
    fn_bare = conf.get(("bare", "helmet"), 0)
    print("confusion", conf)
    print("helmet acc", tp_helmet / (tp_helmet + fn_helmet) if tp_helmet + fn_helmet else 0,
          f"({tp_helmet}/{tp_helmet + fn_helmet})")
    print("bare acc", tp_bare / (tp_bare + fn_bare) if tp_bare + fn_bare else 0,
          f"({tp_bare}/{tp_bare + fn_bare})")


if __name__ == "__main__":
    main()
