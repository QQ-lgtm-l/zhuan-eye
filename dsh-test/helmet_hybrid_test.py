# 离线验证：YOLO 找 person + helmet_cls 判断头部戴帽/裸头
# 只读，不改生产流程
import sys
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

ROOT = Path(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent")
YOLO_WEIGHTS = ROOT / "weights" / "construction_safety.pt"
CLS_WEIGHTS = Path(r"D:\workspace\factory\runs\helmet\helmet_cls\weights\best.pt")


def crop_head(im: Image.Image, bbox):
    W, H = im.size
    x1, y1, x2, y2 = bbox
    bh = y2 - y1
    # 只取人物框最上方 25%，不要横向扩，否则会带进反光背心/肩部
    hx1, hx2 = max(0, int(x1)), min(W, int(x2))
    hy1, hy2 = max(0, int(y1)), min(H, int(y1 + bh * 0.25))
    if hx2 <= hx1 or hy2 <= hy1:
        return None
    return im.crop((hx1, hy1, hx2, hy2))


def main():
    img_path = Path(sys.argv[1] if len(sys.argv) > 1 else r"D:\workspace\factory\tmp-user-test.jpg")
    det = YOLO(str(YOLO_WEIGHTS))
    cls = YOLO(str(CLS_WEIGHTS))
    im = Image.open(img_path).convert("RGB")
    r = det(str(img_path), conf=0.25, imgsz=640, augment=True, verbose=False)[0]
    persons = []
    names = det.names
    for b in r.boxes:
        name = names[int(b.cls[0])]
        if name.lower() in ("person", "none"):
            persons.append([float(x) for x in b.xyxy[0]])
    print(f"persons={len(persons)}", "image=", img_path)
    for i, bbox in enumerate(persons, 1):
        crop = crop_head(im, bbox)
        if crop is None:
            continue
        p = cls(crop, imgsz=224, verbose=False)[0]
        label = p.names[int(p.probs.top1)]
        conf = float(p.probs.top1conf)
        print(f"  person {i}: bbox={[round(x, 1) for x in bbox]} -> {label} conf={conf:.3f}")


if __name__ == "__main__":
    main()
