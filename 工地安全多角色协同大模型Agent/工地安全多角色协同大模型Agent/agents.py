# 五大Agent核心逻辑
# 巡检/分级/派单/协同沟通/台账生成 完整Agent逻辑
# 纯RAG+LLM驱动，不使用硬编码

from state import HazardState
from rag_core import query_safety_rule
from hazard_kb import enrich, kb_context, kb_reference


# 四级隐患：等级、响应时限、整改时限、责任人（与 业务规则改造记录.md 一致）
LEVEL_META = {
    "Ⅰ级重大": {
        "code": "Ⅰ",
        "response_timeout": "0.5小时",
        "rectify_timeout": "24小时",
        "duty_person": "项目经理+专职安全员+施工班组长",
    },
    "Ⅱ级较大": {
        "code": "Ⅱ",
        "response_timeout": "4小时",
        "rectify_timeout": "48小时",
        "duty_person": "专职安全员+施工班组长",
    },
    "Ⅲ级一般": {
        "code": "Ⅲ",
        "response_timeout": "24小时",
        "rectify_timeout": "7天",
        "duty_person": "专职安全员+施工班组长",
    },
    "Ⅳ级轻微": {
        "code": "Ⅳ",
        "response_timeout": "24小时",
        "rectify_timeout": "3天",
        "duty_person": "施工班组长+现场施工人员",
    },
}


def normalize_level(level: str) -> str:
    """兼容旧三级口径，统一成四级标签。"""
    text = (level or "").strip()
    if text in LEVEL_META:
        return text
    if "重大" in text:
        return "Ⅰ级重大"
    if "较大" in text:
        return "Ⅱ级较大"
    if "轻微" in text:
        return "Ⅳ级轻微"
    return "Ⅲ级一般"


def classify_hazard_level(hazard_type: str):
    """优先按结构化知识库定级；KB 未收录才回退关键词规则。"""
    text = (hazard_type or "").strip()
    item = enrich(text)
    if item:
        return item["level"], f"{item['kb_id']}《{item['kb_name']}》按知识库定为{item['level']}；依据：{kb_reference(item)}"

    critical = ("临边", "洞口", "基坑", "高支模", "起重", "倾覆", "坍塌", "堆载", "超高", "高处抛物", "动火")
    major = ("安全带", "连墙件", "安全网", "电缆", "线缆", "私拉", "拖地", "灭火器", "火灾", "触电", "机械")
    minor = ("标识", "保洁", "文明", "垃圾")
    general = ("安全帽", "反光背心", "口罩", "手套", "鞋", "护目镜", "材料堆放", "物料", "通道")

    if any(k in text for k in critical):
        return "Ⅰ级重大", f"“{text}”命中重大隐患关键词，按Ⅰ级立即停工/0.5小时响应/24小时闭环"
    if any(k in text for k in major):
        return "Ⅱ级较大", f"“{text}”命中较大隐患关键词，按Ⅱ级4小时响应/48小时整改"
    if any(k in text for k in minor):
        return "Ⅳ级轻微", f"“{text}”命中轻微隐患关键词，按Ⅳ级24小时提醒/3天自行整改"
    if any(k in text for k in general):
        return "Ⅲ级一般", f"“{text}”按一般隐患处理：24小时接单/7天整改复核"
    return "Ⅲ级一般", f"“{text}”未命中升级关键词，默认按Ⅲ级一般隐患处理，可由安全员人工调整"


# 1. 巡检Agent：接收视觉数据、过滤误检、补全规范
def inspect_agent(state: HazardState) -> HazardState:
    print("【巡检Agent】执行隐患初筛")
    hazard = state.hazard_raw
    if not hazard:
        print("  ⚠️ hazard_raw为空，跳过巡检")
        state.current_agent = "inspect"
        return state

    # 过滤极低置信度（低于0.15认为是误检，跳过后续流程）
    if hazard["confidence"] < 0.15:
        print(f"  ⚠️ 置信度过低 ({hazard['confidence']:.2f} < 0.15)，判定为误检")
        state.hazard_raw = None
        state.current_agent = "inspect"
        return state

    # 先查结构化知识库；命中就用固定条款/措施，未命中才走 RAG
    item = enrich(hazard["hazard_type"])
    if item:
        hazard.update(item)
        rule = kb_context(item)
    else:
        rule = query_safety_rule(f"{hazard['hazard_type']} 建筑安全规范 JGJ GB 风险要求")
    state.rag_standard = rule
    state.current_agent = "inspect"
    print(f"  ✅ 巡检完成：{hazard['hazard_type']} (置信度 {hazard['confidence']:.2f})")
    return state


# 2. 隐患分级Agent：按业务规则确定性输出四级
def level_agent(state: HazardState) -> HazardState:
    print("【隐患分级Agent】执行四级风险分级")
    if not state.hazard_raw:
        print("  ⚠️ hazard_raw为空，跳过分级")
        state.current_agent = "level"
        return state

    hazard_type = state.hazard_raw["hazard_type"]
    level, reason = classify_hazard_level(hazard_type)
    item = enrich(hazard_type)
    meta = LEVEL_META[level]
    response_timeout = (item.get("response_timeout") or meta["response_timeout"]) if item else meta["response_timeout"]
    rectify_timeout = (item.get("rectify_timeout") or meta["rectify_timeout"]) if item else meta["rectify_timeout"]

    state.hazard_level = level
    state.level_code = meta["code"]
    state.response_timeout = response_timeout
    state.rectify_timeout = rectify_timeout
    rule_basis = (state.rag_standard or "").strip()
    state.level_reason = reason + (f"；规范依据：{rule_basis[:200]}" if rule_basis else "")
    state.current_agent = "level"
    print(f"  ✅ 分级完成：{state.hazard_level}（{reason}）")
    return state


# 3. 整改派单Agent：按四级匹配责任人和双时限
def dispatch_agent(state: HazardState) -> HazardState:
    print("【派单Agent】生成整改工单")
    if not state.hazard_raw:
        print("  ⚠️ hazard_raw为空，跳过派单")
        state.current_agent = "dispatch"
        return state

    hazard = state.hazard_raw
    level = normalize_level(state.hazard_level)
    meta = LEVEL_META[level]
    item = enrich(hazard["hazard_type"])
    duty_person = (item.get("duty_person") or meta["duty_person"]) if item else meta["duty_person"]
    response_timeout = (item.get("response_timeout") or meta["response_timeout"]) if item else meta["response_timeout"]
    rectify_timeout = (item.get("rectify_timeout") or meta["rectify_timeout"]) if item else meta["rectify_timeout"]

    task = {
        "hazard_type": hazard["hazard_type"],
        "level": level,
        "level_code": meta["code"],
        "duty_person": duty_person,
        "timeout": rectify_timeout,
        "response_timeout": response_timeout,
        "rectify_timeout": rectify_timeout,
        "rule_basis": (state.rag_standard or "请依据《建筑施工安全检查标准》JGJ 59-2011 现场核查。")[:200],
        "status": "待整改"
    }
    if item:
        task.update({
            "kb_id": item["kb_id"],
            "kb_name": item["kb_name"],
            "standard": item["standard"],
            "clause_no": item["clause_no"],
            "clause_ids": item["clause_ids"],
            "rectify_measure": item["rectify_measure"],
            "control_requirement": item["control_requirement"],
        })
    state.hazard_level = level
    state.level_code = meta["code"]
    state.response_timeout = response_timeout
    state.rectify_timeout = rectify_timeout
    state.rectify_task = task
    state.current_agent = "dispatch"
    print(f"  ✅ 派单完成：{task['hazard_type']} → {task['duty_person']}（响应{meta['response_timeout']} / 整改{meta['rectify_timeout']}）")
    return state


# 4. 多方协同沟通Agent：自动推送、催办、对话应答
def chat_agent(state: HazardState) -> HazardState:
    print("【协同沟通Agent】发起多方通知")
    if not state.rectify_task:
        print("  ⚠️ rectify_task为空，跳过协同沟通")
        state.current_agent = "chat"
        return state

    task = state.rectify_task

    # KB 命中时用固定整改措施；未命中才 RAG
    rag_suggestion = task.get("rectify_measure") or query_safety_rule(
        f"{task['hazard_type']} 整改措施 处理方法 预防措施 建筑施工安全"
    )

    msg = f"""
    【安全隐患整改通知】

    🚨 隐患类型：{task['hazard_type']}
    ⚠️ 风险等级：{task['level']}
    👤 责任人员：{task['duty_person']}
    ⏱️ 响应时限：{task.get('response_timeout', '')}
    ⏱️ 整改时限：{task.get('rectify_timeout', task.get('timeout', ''))}

    📋 整改建议：
    {rag_suggestion}

    📖 依据：{task['rule_basis']}

    请按时完成整改并上传复检照片！
    """
    state.chat_records.append({
        "role": "AI安全Agent",
        "msg": msg.strip()
    })
    state.current_agent = "chat"
    print(f"  ✅ 协同通知已发送")
    return state


# 5. 台账自动生成Agent：全流程归档
def ledger_agent(state: HazardState) -> HazardState:
    print("【台账生成Agent】自动归档台账")
    if not state.hazard_raw:
        print("  ⚠️ hazard_raw为空，跳过台账归档")
        state.current_agent = "ledger"
        return state

    state.ledger_data = {
        "hazard_info": state.hazard_raw,
        "level_info": state.hazard_level,
        "level_code": state.level_code,
        "level_reason": state.level_reason,
        "response_timeout": state.response_timeout,
        "rectify_timeout": state.rectify_timeout,
        "task_info": state.rectify_task,
        "kb_info": {
            k: state.rectify_task.get(k)
            for k in ("kb_id", "kb_name", "standard", "clause_no", "rectify_measure", "control_requirement")
            if state.rectify_task and state.rectify_task.get(k)
        },
        "chat_logs": state.chat_records,
        "finish_time": state.hazard_raw["time"]
    }
    state.current_agent = "ledger"
    print(f"  ✅ 台账归档完成")
    return state
