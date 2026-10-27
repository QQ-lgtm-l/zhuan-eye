package com.example.Kcsj.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * 邮箱验证码服务。
 *
 * 未配置 SMTP（spring.mail.host / password 为空）时自动进入「演示模式」：
 * 验证码不发送邮件，而是直接随接口返回给前端，并在后端日志打印，方便本地演示。
 * 配置真实邮箱后自动切换为真实发送，验证码不再返回给前端。
 */
@Service
public class EmailCodeService {

    private static final Logger log = LoggerFactory.getLogger(EmailCodeService.class);
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final long CODE_TTL = 5 * 60 * 1000L;
    private static final long RESEND_GAP = 60 * 1000L;
    private static final long VERIFIED_TTL = 10 * 60 * 1000L;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    private final Map<String, CodeEntry> codes = new ConcurrentHashMap<>();
    private final Map<String, Long> verified = new ConcurrentHashMap<>();
    /** 最近一次发送时间（与验证码分开存，验证码被消费后仍能限制 60 秒重发） */
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

    public boolean isValidEmail(String email) {
        return email != null && EMAIL_PATTERN.matcher(email.trim()).matches();
    }

    private String key(String scene, String email) {
        return (scene == null || scene.isBlank() ? "register" : scene.trim()) + ":" + email.trim().toLowerCase();
    }

    /** 发送验证码，返回 {mock, code?, message} */
    public Map<String, Object> send(String email, String scene) {
        if (!isValidEmail(email)) {
            throw new IllegalArgumentException("邮箱格式不正确");
        }
        String key = key(scene, email);
        long now = System.currentTimeMillis();
        Long previous = lastSent.get(key);
        if (previous != null && now - previous < RESEND_GAP) {
            long wait = (RESEND_GAP - (now - previous)) / 1000 + 1;
            throw new IllegalStateException("验证码已发送，请 " + wait + " 秒后再试");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        codes.put(key, new CodeEntry(code, now + CODE_TTL));
        lastSent.put(key, now);

        Map<String, Object> result = new HashMap<>();
        if (realMailEnabled()) {
            try {
                sendMail(email.trim(), code, scene);
            } catch (Exception e) {
                codes.remove(key);
                log.error("验证码邮件发送失败: {}", e.getMessage(), e);
                throw new IllegalStateException("验证码邮件发送失败，请检查邮箱配置");
            }
            result.put("mock", false);
            result.put("message", "验证码已发送至邮箱，5 分钟内有效");
        } else {
            log.info("[演示模式] {} 的 {} 验证码：{}", email, scene, code);
            result.put("mock", true);
            result.put("code", code);
            result.put("message", "演示模式：验证码 " + code + "（未配置邮箱服务，已直接返回）");
        }
        return result;
    }

    /** 校验验证码，成功后标记该邮箱已验证（10 分钟内有效） */
    public void verify(String email, String scene, String code) {
        String key = key(scene, email);
        CodeEntry entry = codes.get(key);
        if (entry == null) {
            throw new IllegalStateException("请先获取验证码");
        }
        if (System.currentTimeMillis() > entry.expireAt) {
            codes.remove(key);
            throw new IllegalStateException("验证码已过期，请重新获取");
        }
        if (code == null || !entry.code.equals(code.trim())) {
            throw new IllegalStateException("验证码不正确");
        }
        codes.remove(key);
        verified.put(key, System.currentTimeMillis() + VERIFIED_TTL);
    }

    /** 消费「已验证」标记（注册时使用，一次性） */
    public boolean consumeVerified(String email, String scene) {
        if (!isValidEmail(email)) return false;
        Long expireAt = verified.remove(key(scene, email));
        return expireAt != null && expireAt > System.currentTimeMillis();
    }

    private boolean realMailEnabled() {
        return mailSender != null
                && mailHost != null && !mailHost.trim().isEmpty()
                && mailPassword != null && !mailPassword.trim().isEmpty();
    }

    private void sendMail(String email, String code, String scene) {
        SimpleMailMessage message = new SimpleMailMessage();
        String from = (mailFrom != null && !mailFrom.trim().isEmpty()) ? mailFrom.trim() : mailUsername;
        if (from != null && !from.trim().isEmpty()) {
            message.setFrom(from);
        }
        message.setTo(email);
        message.setSubject("【筑安慧眼】邮箱验证码");
        message.setText("您好：\n\n"
                + "你正在进行" + ("reset".equals(scene) ? "重置密码" : "注册账号") + "操作，验证码为：" + code + "\n\n"
                + "验证码 5 分钟内有效，请勿泄露给他人。若非本人操作，请忽略此邮件。\n\n"
                + "—— 筑安慧眼 · 房建施工现场隐患闭环协同管控系统");
        mailSender.send(message);
    }
}
