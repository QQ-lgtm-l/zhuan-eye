-- 工单主责账号：用于列表过滤与后端操作鉴权
ALTER TABLE work_order
    ADD COLUMN assignee_id INT NULL COMMENT '主责账号ID' AFTER record_id,
    ADD COLUMN assignee_name VARCHAR(50) NULL COMMENT '主责姓名' AFTER assignee_id,
    ADD COLUMN assignee_role VARCHAR(20) NULL COMMENT '主责角色' AFTER assignee_name,
    ADD INDEX idx_work_order_assignee (assignee_id);

-- 旧工单按等级补主责账号（当前演示账号）
UPDATE work_order w JOIN user u ON u.id = 49
SET w.assignee_id = u.id, w.assignee_name = u.name, w.assignee_role = u.role
WHERE w.level LIKE 'Ⅰ%';

UPDATE work_order w JOIN user u ON u.id = 52
SET w.assignee_id = u.id, w.assignee_name = u.name, w.assignee_role = u.role
WHERE w.level LIKE 'Ⅱ%';

UPDATE work_order w JOIN user u ON u.id = 60
SET w.assignee_id = u.id, w.assignee_name = u.name, w.assignee_role = u.role
WHERE w.level LIKE 'Ⅲ%';

UPDATE work_order w JOIN user u ON u.id = 63
SET w.assignee_id = u.id, w.assignee_name = u.name, w.assignee_role = u.role
WHERE w.level LIKE 'Ⅳ%';
