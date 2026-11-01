# 统一多Agent全局状态，全流程数据贯穿

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# 全局状态：所有Agent共享上下文
class HazardState(BaseModel):
    # 视觉感知原始数据
    hazard_raw: Optional[Dict[str, Any]] = None
    # RAG知识库返回规范依据
    rag_standard: str = ""
    # 硬编码规则（兜底方案，确保一定有结果）
    hardcoded_rule: Optional[Dict[str, Any]] = None
    # 隐患分级结果（四级：Ⅰ级重大/Ⅱ级较大/Ⅲ级一般/Ⅳ级轻微）
    hazard_level: str = ""
    level_code: str = ""
    level_reason: str = ""
    # 分级对应的响应/整改时限
    response_timeout: str = ""
    rectify_timeout: str = ""
    # 人工调级留痕（M2 预留，M3/M4 页面接入）
    adjusted_level: Optional[str] = None
    adjust_reason: Optional[str] = None
    adjust_user: Optional[str] = None
    adjust_time: Optional[str] = None
    # 派单整改信息
    rectify_task: Optional[Dict[str, Any]] = None
    # 多方沟通记录
    chat_records: List[Dict[str, str]] = Field(default_factory=list)
    # 台账数据
    ledger_data: Optional[Dict[str, Any]] = None
    # 当前节点
    current_agent: str = ""