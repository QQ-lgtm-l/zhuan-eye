package com.example.Kcsj.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 统一异常处理：把数据库/服务器异常转换成前端能直接看懂的中文提示，
 * 避免页面只弹出 Internal Server Error。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public Result<?> handle(Exception e) {
        log.error("请求处理失败", e);
        String raw = rootMessage(e);
        if (isDatabaseError(e, raw)) {
            return Result.error("-1",
                    "数据库连接失败：请确认 MySQL 已启动、已创建数据库 yoloai 并导入 yoloai.sql，" +
                            "且 application.properties 中的数据库账号密码正确");
        }
        String message = raw == null ? "服务器内部错误" : raw.replaceAll("\\s+", " ").trim();
        if (message.length() > 120) {
            message = message.substring(0, 120) + "...";
        }
        return Result.error("-1", "服务器内部错误：" + message);
    }

    private boolean isDatabaseError(Throwable e, String message) {
        Throwable current = e;
        while (current != null) {
            String name = current.getClass().getName();
            if (name.contains("DataAccessException") || name.contains("SQLException")
                    || name.contains("CannotGetJdbcConnectionException")) {
                return true;
            }
            current = current.getCause();
        }
        if (message == null) return false;
        String lower = message.toLowerCase();
        return lower.contains("access denied")
                || lower.contains("unknown database")
                || lower.contains("communications link failure")
                || lower.contains("connection refused")
                || lower.contains("cannot get jdbc connection")
                || lower.contains("could not create connection");
    }

    private String rootMessage(Throwable e) {
        Throwable current = e;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current.getMessage();
    }
}
