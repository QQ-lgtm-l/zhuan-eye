package com.example.Kcsj.controller;

import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.Message;
import com.example.Kcsj.mapper.MessageMapper;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/message")
public class MessageController {
    @Resource
    MessageMapper messageMapper;

    @GetMapping("/{userId}")
    public Result<?> findByUserId(@PathVariable String userId) {
        try {
            List<Message> messages = messageMapper.findByUserId(userId);
            return Result.success(messages);
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @GetMapping("/{userId}/unreadCount")
    public Result<?> countUnread(@PathVariable String userId) {
        try {
            Integer count = messageMapper.countUnread(userId);
            Map<String, Object> result = new HashMap<>();
            result.put("count", count);
            return Result.success(result);
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/read")
    public Result<?> markRead(@PathVariable Integer id) {
        try {
            messageMapper.markRead(id);
            return Result.success("已标记为已读");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PostMapping("/{userId}/readAll")
    public Result<?> markAllRead(@PathVariable String userId) {
        try {
            messageMapper.markAllRead(userId);
            return Result.success("已全部标记为已读");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PostMapping
    public Result<?> create(@RequestBody Message message) {
        try {
            if (message.getIsRead() == null) {
                message.setIsRead(0);
            }
            messageMapper.insert(message);
            return Result.success("消息创建成功");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Integer id) {
        try {
            messageMapper.softDelete(id);
            return Result.success("消息删除成功");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/{userId}/clear")
    public Result<?> clearAll(@PathVariable String userId) {
        try {
            messageMapper.softDeleteAll(userId);
            return Result.success("消息清空成功");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }
}