CREATE TABLE IF NOT EXISTS `message` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` varchar(50) DEFAULT NULL COMMENT '用户ID',
  `type` varchar(20) DEFAULT NULL COMMENT '消息类型：warning/info/success',
  `title` varchar(200) DEFAULT NULL COMMENT '消息标题',
  `content` text COMMENT '消息内容',
  `create_time` varchar(50) DEFAULT NULL COMMENT '创建时间',
  `is_read` int(1) DEFAULT 0 COMMENT '已读状态：0-未读，1-已读',
  `work_order_id` int(11) DEFAULT NULL COMMENT '关联工单ID',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_work_order_id` (`work_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';