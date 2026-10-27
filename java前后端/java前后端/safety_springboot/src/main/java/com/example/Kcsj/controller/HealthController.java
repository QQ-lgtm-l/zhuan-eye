package com.example.Kcsj.controller;

import com.example.Kcsj.common.Result;
import com.example.Kcsj.mapper.UserMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 环境自检：用来快速确认后端和数据库是否就绪。
 * 浏览器访问 http://localhost:9999/health
 */
@RestController
public class HealthController {

    @Resource
    private UserMapper userMapper;

    @GetMapping("/health")
    public Result<?> health() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("backend", "ok");
        try {
            Number count = userMapper.selectCount(null);
            data.put("database", "ok");
            data.put("users", count);
            return Result.success(data);
        } catch (Exception e) {
            data.put("database", "error");
            data.put("message", "数据库连接失败，请检查 MySQL、数据库 yoloai 及账号密码配置");
            return Result.error("-1", "数据库未就绪：" + rootMessage(e));
        }
    }

    private String rootMessage(Throwable e) {
        Throwable current = e;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        String message = current.getMessage();
        if (message == null) return "未知错误";
        return message.replaceAll("\\s+", " ").trim();
    }
}
