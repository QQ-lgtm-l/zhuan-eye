-- M2：工单四级隐患迁移（可重复执行前先确认列不存在）
ALTER TABLE work_order
    ADD COLUMN response_deadline VARCHAR(50) NULL AFTER deadline,
    ADD COLUMN rectify_deadline VARCHAR(50) NULL AFTER response_deadline,
    ADD COLUMN adjusted_level VARCHAR(20) NULL AFTER rectify_deadline,
    ADD COLUMN adjust_reason VARCHAR(500) NULL AFTER adjusted_level,
    ADD COLUMN adjust_user VARCHAR(50) NULL AFTER adjust_reason,
    ADD COLUMN adjust_time VARCHAR(50) NULL AFTER adjust_user;

UPDATE work_order
SET level = CASE
    WHEN level LIKE '%重大%' THEN 'Ⅰ级重大'
    WHEN level LIKE '%较大%' THEN 'Ⅱ级较大'
    WHEN level LIKE '%轻微%' THEN 'Ⅳ级轻微'
    ELSE 'Ⅲ级一般'
END;

UPDATE IGNORE work_order
SET deadline = CASE
        WHEN level = 'Ⅰ级重大' THEN '24小时'
        WHEN level = 'Ⅱ级较大' THEN '48小时'
        WHEN level = 'Ⅲ级一般' THEN '7天'
        ELSE '3天'
    END,
    response_deadline = DATE_FORMAT(
        DATE_ADD(create_time, INTERVAL CASE
            WHEN level = 'Ⅰ级重大' THEN 30
            WHEN level = 'Ⅱ级较大' THEN 240
            ELSE 1440
        END MINUTE), '%Y-%m-%d %H:%i:%s'),
    rectify_deadline = DATE_FORMAT(
        DATE_ADD(create_time, INTERVAL CASE
            WHEN level = 'Ⅰ级重大' THEN 1440
            WHEN level = 'Ⅱ级较大' THEN 2880
            WHEN level = 'Ⅲ级一般' THEN 10080
            ELSE 4320
        END MINUTE), '%Y-%m-%d %H:%i:%s')
WHERE create_time IS NOT NULL;
