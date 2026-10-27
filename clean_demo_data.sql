-- 清理演示数据（保留原有真实数据）
USE yoloai;
DELETE FROM message WHERE title LIKE '【演示】%';
DELETE FROM work_order WHERE order_no LIKE 'WO-DEMO-%';
DELETE FROM imgrecords WHERE suggestion LIKE '【演示数据】%';
DELETE FROM videorecords WHERE username LIKE 'demo\_%' OR suggestion LIKE '【演示数据】%';
DELETE FROM user WHERE email LIKE '%@example.com' OR username LIKE 'demo\_%';
SELECT 'remaining users' AS item, COUNT(*) AS cnt FROM user;
