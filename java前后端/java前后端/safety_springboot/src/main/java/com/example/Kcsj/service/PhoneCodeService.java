package com.example.Kcsj.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * 手机验证码服务（演示模式）。
 *
 * 当前没有接入短信服务商，验证码不真正发送短信，而是直接随接口返回给页面，
 * 并打印在后端日志中，用于本地演示/联调。以后接入阿里云/腾讯云短信时，
 * 只需要把 send 方法里「返回验证码」换成调用短信 SDK，其余逻辑不变。
 */
@Service
public class PhoneCodeService {

    private static final Logger log = LoggerFactory.getLogger(PhoneCodeService.class);
    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    private static final long CODE_TTL = 5 * 60 * 1000L;
    private static final long RESEND_GAP = 60 * 1000L;

    private final Map<String, CodeEntry> codes = new ConcurrentHashMap<>();
    private final Map<String, Long> lastSent = new ConcurrentHashMap<>();
    private final Random random = new Random();

    public static class CodeEntry {
        final String code;
        final long expireAt;

        CodeEntry(String code, long expireAt) {
            this.code = code;
            this.expireAt = expireAt;
        }
    }

    public boolean isValidPhone(String phone) {
        return phone != null && PHONE_PATTERN.matcher(phone.trim()).matches();
    }

    private String key(String phone) {
        return "phone:" + phone.trim();
    }

    /** 发送验证码（演示模式直接返回验证码） */
    public Map<String, Object> send(String phone) {
        if (!isValidPhone(phone)) {
            throw new IllegalArgumentException("手机号格式不正确");
        }
        String key = key(phone);
        long now = System.currentTimeMillis();
        Long previous = lastSent.get(key);
        if (previous != null && now - previous < RESEND_GAP) {
            long wait = (RESEND_GAP - (now - previous)) / 1000 + 1;
            throw new IllegalStateException("验证码已发送，请 " + wait + " 秒后再试");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        codes.put(key, new CodeEntry(code, now + CODE_TTL));
        lastSent.put(key, now);
        log.info("[演示模式] 手机号 {} 的验证码：{}", phone, code);

        Map<String, Object> result = new HashMap<>();
        result.put("mock", true);
        result.put("code", code);
        result.put("message", "演示模式：短信验证码 " + code + "（未接短信服务商，已直接返回）");
        return result;
    }

    /** 只校验，不消费（注册写库成功后再消费，避免数据库失败导致验证码作废） */
    public void check(String phone, String code) {
        if (!isValidPhone(phone)) {
            throw new IllegalArgumentException("手机号格式不正确");
        }
        CodeEntry entry = codes.get(key(phone));
        if (entry == null) {
            throw new IllegalStateException("请先获取验证码");
        }
        if (System.currentTimeMillis() > entry.expireAt) {
            codes.remove(key(phone));
            throw new IllegalStateException("验证码已过期，请重新获取");
        }
        if (code == null || !entry.code.equals(code.trim())) {
            throw new IllegalStateException("验证码不正确");
        }
    }

    /** 注册成功后消费验证码 */
    public void consume(String phone, String code) {
        String key = key(phone);
        CodeEntry entry = codes.get(key);
        if (entry != null && code != null && entry.code.equals(code.trim())) {
            codes.remove(key);
        }
    }
}
