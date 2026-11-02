"""结构化隐患知识库：40 条官方/项目隐患口径。

用途：
1. 先按隐患名称/别名查 KB，得到等级、时限、责任人、整改措施、法规依据；
2. 查不到时才回退旧的 RAG/关键词逻辑；
3. 输出保留 kb_id、standard、clause_no，避免模型自由编条款。
"""
import json
import re
from functools import lru_cache
from pathlib import Path

KB_PATH = Path(__file__).with_name("hazard_kb.json")

# 模型输出的隐患名 -> KB 编号；只做明确别名，不做模糊猜测
ALIASES = {
    "未佩戴安全帽": "R001",
    "未戴安全帽": "R001",
    "不戴安全帽": "R001",
    "安全帽佩戴不规范": "R002",
    "未系安全带": "G006",
    "不系安全带": "G006",
    "安全带低挂高用": "G006",
    "临边防护缺失": "G001",
    "楼层临边无防护": "G001",
    "临边无防护": "G001",
    "电梯井口无防护": "G003",
    "电梯井口": "G003",
    "预留洞口未防护": "G002",
    "洞口未盖板": "G002",
    "未穿防滑安全鞋": "R003",
    "未穿防滑鞋": "R003",
    "穿拖鞋": "R003",
    "电线拖拽": "D004",
    "线缆乱拖": "D004",
    "电线乱拉": "D004",
    "电缆拖地": "D004",
    "线缆破皮": "D005",
    "铜线裸露": "D005",
    "配电箱未上锁": "D003",
    "配电箱破损": "D003",
    "灭火器失效": "X004",
    "灭火器过期": "X004",
    "动火无审批": "X001",
    "违规动火": "X001",
    "材料堆放不规范": "W002",
    "材料乱堆": "W002",
    "物料乱堆": "W002",
    "消防通道堵塞": "X003",
    "安全通道堵塞": "X003",
    "脚手架缺少连墙件": "Q006",
    "连墙件缺失": "Q006",
    "脚手架安全网破损": "G005",
    "安全网破损": "G005",
    "基坑边坡无支护": "T001",
    "基坑坍塌": "T001",
    "消防通道堵塞": "X003",
    "漏电保护器失效": "D002",
    "开关箱漏电保护器失效": "D002",
    "脚手板未满铺": "G004",
    "脚手架未铺设脚手板": "G004",
    "私拉乱接电线": "D004",
    "电缆拖地泡水": "D004",
    "脚手架连墙件缺失": "Q006",
    "附墙件缺失": "Q006",
    "配电箱未上锁": "D003",
    "洞口防护缺失": "G002",
    "安全带低挂高用": "G006",
}


def _norm(text: str) -> str:
    return re.sub(r"[\s，。；、,.;:：/（）()\-]+", "", (text or "").strip().lower())


@lru_cache(maxsize=1)
def load_kb():
    data = json.loads(KB_PATH.read_text(encoding="utf-8"))
    by_id = {item["kb_id"]: item for item in data}
    by_name = {_norm(item["name"]): item for item in data}
    return data, by_id, by_name


def find_hazard(hazard_type: str):
    """返回命中的 KB 条目；宁可返回 None，也不乱配等级。"""
    text = (hazard_type or "").strip()
    if not text:
        return None
    _, by_id, by_name = load_kb()

    kb_id = ALIASES.get(text)
    if kb_id and kb_id in by_id:
        return by_id[kb_id]

    key = _norm(text)
    if key in by_name:
        return by_name[key]

    # 包含匹配：取重叠最长的一条，至少 3 个字，避免“安全帽”误配“安全帽佩戴不规范”
    candidates = []
    for name, item in by_name.items():
        if len(key) >= 3 and (key in name or name in key):
            overlap = len(set(key) & set(name))
            candidates.append((overlap, len(name), item))
    if candidates:
        candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return candidates[0][2]
    return None


def kb_reference(item) -> str:
    """给 Agent/前端引用的短文本；条款号未补时明确写待补。"""
    if not item:
        return ""
    clause = (item.get("clause_no") or "").strip()
    if not clause or clause == "待补":
        return f"{item.get('standard', '')}（条款号待补）"
    return f"{item.get('standard', '')} {clause}"


def kb_context(item) -> str:
    """给 RAG/LLM 的结构化上下文，只允许引用这些内容。"""
    if not item:
        return ""
    parts = [
        f"隐患编号：{item['kb_id']}",
        f"隐患名称：{item.get('name') or item.get('kb_name', '')}",
        f"类别：{item.get('category', '')}",
        f"法规依据：{kb_reference(item)}",
        f"风险等级：{item.get('project_level', '')}",
        f"AI识别特征：{item.get('ai_features', '')}",
        f"危害后果：{item.get('consequence', '')}",
        f"整改措施：{item.get('rectify_measure', '')}",
        f"管控要求：{item.get('control_requirement', '')}",
    ]
    return "\n".join(p for p in parts if p.split("：", 1)[-1].strip())


def enrich(hazard_type: str):
    """把 KB 条目转成 Agent 可直接合并的字段；无命中返回空 dict。"""
    item = find_hazard(hazard_type)
    if not item:
        return {}
    return {
        "kb_id": item["kb_id"],
        "kb_name": item["name"],
        "category": item.get("category", ""),
        "standard": item.get("standard", ""),
        "clause_no": item.get("clause_no", ""),
        "clause_ids": [item["kb_id"]],
        "level": item.get("project_level", ""),
        "level_code": item.get("level_code", ""),
        "response_timeout": item.get("response_timeout", ""),
        "rectify_timeout": item.get("rectify_timeout", ""),
        "duty_person": item.get("duty_person", ""),
        "rectify_measure": item.get("rectify_measure", ""),
        "control_requirement": item.get("control_requirement", ""),
        "consequence": item.get("consequence", ""),
        "ai_features": item.get("ai_features", ""),
        "visual_status": item.get("visual_status", ""),
        "model_class": item.get("model_class", ""),
        "source_sheet": item.get("source_sheet", ""),
    }
