import json
from pathlib import Path

from openpyxl import load_workbook

SRC = Path(r"D:\xwechat_files\wxid_h1p55utmxre022_fc6f\msg\file\2026-11\施工现场安全隐患智能识别知识库.xlsx")
OUT = Path(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent\hazard_kb.json")

LEVEL_MAP = {
    "红色Ⅰ级重大隐患": ("Ⅰ级重大", "Ⅰ"),
    "橙色Ⅱ级较大隐患": ("Ⅱ级较大", "Ⅱ"),
    "黄色Ⅲ级一般隐患": ("Ⅲ级一般", "Ⅲ"),
    "蓝色Ⅳ级轻微隐患": ("Ⅳ级轻微", "Ⅳ"),
}
META = {
    "Ⅰ级重大": {"response": "0.5小时", "rectify": "24小时", "duty": "项目经理+专职安全员+施工班组长"},
    "Ⅱ级较大": {"response": "4小时", "rectify": "48小时", "duty": "专职安全员+施工班组长"},
    "Ⅲ级一般": {"response": "24小时", "rectify": "7天", "duty": "专职安全员+施工班组长"},
    "Ⅳ级轻微": {"response": "24小时", "rectify": "3天", "duty": "施工班组长+现场施工人员"},
}

# 当前/规划中的视觉能力；没有把握的写“否”或“待模型”
VISUAL = {
    "G001": ("部分", "edge_cls,barricade"),
    "G003": ("部分", "edge_cls,barricade"),
    "G005": ("部分", "safety_net"),
    "R001": ("是", "no-hardhat"),
    "R002": ("部分", "hardhat"),
    "R003": ("部分", "safety_shoes"),
    "W001": ("部分", "barricade"),
    "W002": ("待模型", "material_cls"),
    "X004": ("待模型", "fire_extinguisher"),
}

wb = load_workbook(SRC, data_only=True)
rows = []
for ws in wb.worksheets:
    if ws.title == "总览说明":
        continue
    category = ws.title.replace("安全隐患库", "")
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row[0]:
            continue
        kb_id = str(row[0]).strip()
        official_raw = str(row[3]).strip()
        level, code = LEVEL_MAP[official_raw]
        meta = META[level]
        visual_status, model_class = VISUAL.get(kb_id, ("否", ""))
        rows.append({
            "kb_id": kb_id,
            "name": str(row[1]).strip(),
            "category": category,
            "standard": str(row[2]).strip(),
            "clause_no": "待补",
            "clause_text": "",
            "official_level_raw": official_raw,
            "official_level": level,
            "project_level": level,
            "level_code": code,
            "response_timeout": meta["response"],
            "rectify_timeout": meta["rectify"],
            "duty_person": meta["duty"],
            "ai_features": str(row[4]).strip(),
            "consequence": str(row[5]).strip(),
            "rectify_measure": str(row[6]).strip(),
            "control_requirement": str(row[7]).strip(),
            "visual_status": visual_status,
            "model_class": model_class,
            "source_sheet": ws.title,
        })

OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
print("rows", len(rows), "->", OUT)
print("levels", {r["project_level"] for r in rows})
print("visual", {r["visual_status"] for r in rows})
