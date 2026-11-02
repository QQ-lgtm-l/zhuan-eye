# 把 construction-site-safety 的真实 test 图导入图片检测记录（12 张）
# 用当前主模型生成标注图，写 imgrecords；不创建工单
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent")
SRC = ROOT / "datasets" / "construction-site-safety" / "images" / "test"
TMP = Path(r"D:\workspace\factory\real_import_files")
TMP.mkdir(parents=True, exist_ok=True)
OUTPUT_SQL = Path(r"D:\workspace\factory\import_real_images.sql")

import sys
sys.path.insert(0, str(ROOT))
from multi_detect import EnhancedMultiHazardDetector

def q(s):
    return "'" + str(s or "").replace("'", "''") + "'"

def main():
    imgs = sorted(SRC.glob("*.jpg"))[:12]
    det = EnhancedMultiHazardDetector(str(ROOT / "weights" / "construction_safety.pt"), str(ROOT / "weights" / "yolov8s.pt"))
    rows = []
    for idx, src in enumerate(imgs, 1):
        name = f"real_{idx:02d}_{src.stem}.jpg"
        dst = TMP / name
        shutil.copyfile(src, dst)
        r = det.detect_image(str(dst), conf_thres=0.25)
        # 画框
        im = Image.open(dst).convert("RGB")
        draw = ImageDraw.Draw(im)
        for h in r["hazards"]:
            b = h.get("bbox") or []
            if len(b) == 4:
                draw.rectangle(b, outline=(255, 0, 0), width=3)
        out_name = f"real_{idx:02d}_out.jpg"
        im.save(TMP / out_name, quality=92)
        labels = [h.get("hazard_type", "") for h in r["hazards"]]
        confs = [str(h.get("confidence", "")) for h in r["hazards"]]
        suggestion = "；".join(labels) if labels else "未发现明显隐患"
        rows.append({
            "input_img": f"http://127.0.0.1:9999/files/{name}",
            "out_img": f"http://127.0.0.1:9999/files/{out_name}",
            "confidence": json.dumps(confs, ensure_ascii=False),
            "all_time": "0.5",
            "conf": 0.25,
            "weight": "construction_safety.pt",
            "username": "admin",
            "start_time": "",
            "label": json.dumps(labels, ensure_ascii=False),
            "ai": "ai_recheck",
            "suggestion": suggestion,
        })
        print(idx, src.name, len(labels), labels[:3])
    lines = ["USE yoloai;"]
    for r in rows:
        lines.append(
            "INSERT INTO imgrecords (input_img,out_img,confidence,all_time,conf,weight,username,start_time,label,ai,suggestion) VALUES ("
            + ",".join([
                q(r["input_img"]), q(r["out_img"]), q(r["confidence"]), q(r["all_time"]),
                str(r["conf"]), q(r["weight"]), q(r["username"]), q(r["start_time"]),
                q(r["label"]), q(r["ai"]), q(r["suggestion"])
            ]) + ");"
        )
    OUTPUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("rows", len(rows), "sql", OUTPUT_SQL)

if __name__ == "__main__":
    main()
