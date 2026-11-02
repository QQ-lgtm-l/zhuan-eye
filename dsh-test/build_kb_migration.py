import json
import sys
from pathlib import Path

sys.path.insert(0, r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent")
from hazard_kb import find_hazard  # noqa: E402

KB_JSON = Path(r"D:\workspace\factory\工地安全多角色协同大模型Agent\工地安全多角色协同大模型Agent\hazard_kb.json")
OUT = Path(r"D:\workspace\factory\dsh-test\kb-p0-migration.sql")

TYPES = [
    "未佩戴安全帽", "未穿反光背心", "未戴防护眼镜", "材料堆放超高", "消防通道堵塞",
    "灭火器失效", "漏电保护器失效", "脚手板未满铺", "临边防护缺失", "私拉乱接电线",
    "脚手架连墙件缺失", "安全带低挂高用", "未佩戴耳塞", "未戴防护手套", "电缆拖地泡水",
    "未佩戴防尘口罩", "未系安全带", "配电箱未上锁", "施工扬尘未覆盖", "未穿防滑鞋",
    "洞口防护缺失", "高处抛物",
]
# 已在上一条 SQL 查询中确认的工单类型；未匹配的保留原等级
INTERVALS = {"0.5小时": "30 MINUTE", "4小时": "4 HOUR", "24小时": "24 HOUR", "48小时": "48 HOUR", "7天": "7 DAY", "3天": "3 DAY"}

data = json.loads(KB_JSON.read_text(encoding="utf-8"))

def q(v):
    return "'" + str(v or "").replace("'", "''") + "'"

lines = [
    "-- 新增知识库表；执行前已备份 backup-yoloai-before-kb-20261102.sql",
    "CREATE TABLE IF NOT EXISTS hazard_kb (",
    "  kb_id varchar(20) NOT NULL PRIMARY KEY,",
    "  name varchar(200) NOT NULL,",
    "  category varchar(100),",
    "  standard varchar(255),",
    "  clause_no varchar(100),",
    "  clause_text text,",
    "  official_level_raw varchar(30),",
    "  official_level varchar(20),",
    "  project_level varchar(20),",
    "  level_code varchar(10),",
    "  response_timeout varchar(30),",
    "  rectify_timeout varchar(30),",
    "  duty_person varchar(200),",
    "  ai_features text,",
    "  consequence text,",
    "  rectify_measure text,",
    "  control_requirement text,",
    "  visual_status varchar(20),",
    "  model_class varchar(100),",
    "  source_sheet varchar(100),",
    "  created_at datetime DEFAULT CURRENT_TIMESTAMP",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    "",
    "-- 工单补知识库匹配/来源字段",
    "ALTER TABLE work_order ADD COLUMN kb_id varchar(20) NULL;",
    "ALTER TABLE work_order ADD COLUMN level_source varchar(30) NULL;",
    "ALTER TABLE work_order ADD COLUMN original_level varchar(20) NULL;",
    "",
]

for item in data:
    cols = ["kb_id", "name", "category", "standard", "clause_no", "clause_text",
            "official_level_raw", "official_level", "project_level", "level_code",
            "response_timeout", "rectify_timeout", "duty_person", "ai_features",
            "consequence", "rectify_measure", "control_requirement", "visual_status",
            "model_class", "source_sheet"]
    vals = [q(item.get(c, "")) for c in cols]
    lines.append(
        "INSERT INTO hazard_kb (" + ",".join(cols) + ") VALUES (" + ",".join(vals) + ");"
    )

lines.append("")
for t in TYPES:
    item = find_hazard(t)
    if item:
        resp = INTERVALS[item["response_timeout"]]
        rect = INTERVALS[item["rectify_timeout"]]
        lines.append(
            "UPDATE work_order SET original_level=COALESCE(original_level, level), "
            f"kb_id={q(item['kb_id'])}, level={q(item['project_level'])}, level_source='知识库', "
            f"deadline={q(item['rectify_timeout'])}, "
            "response_deadline=DATE_FORMAT(DATE_ADD(create_time, INTERVAL " + resp + "), '%Y-%m-%d %H:%i:%s'), "
            "rectify_deadline=DATE_FORMAT(DATE_ADD(create_time, INTERVAL " + rect + "), '%Y-%m-%d %H:%i:%s') "
            f"WHERE hidden_type={q(t)};"
        )
    else:
        lines.append(
            "UPDATE work_order SET original_level=COALESCE(original_level, level), "
            "level_source='保留原级（知识库未匹配）' "
            f"WHERE hidden_type={q(t)};"
        )

lines.append("")
lines.append("UPDATE work_order SET level_source='保留原级（知识库未匹配）' WHERE level_source IS NULL;")
lines.append("")
lines.append("-- 校验：知识库条数、工单等级分布、未匹配类型")
lines.append("SELECT COUNT(*) AS kb_count FROM hazard_kb;")
lines.append("SELECT level, COUNT(*) AS cnt FROM work_order GROUP BY level ORDER BY level;")
lines.append("SELECT hidden_type, level, level_source, COUNT(*) AS cnt FROM work_order WHERE level_source LIKE '保留%' GROUP BY hidden_type, level, level_source;")

OUT.write_text("\n".join(lines), encoding="utf-8")
print("wrote", OUT, "lines", len(lines), "kb", len(data))
