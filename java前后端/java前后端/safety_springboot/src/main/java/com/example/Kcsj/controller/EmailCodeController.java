package com.example.Kcsj.controller;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.mapper.UserMapper;
import com.example.Kcsj.service.EmailCodeService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 邮箱验证码：注册验证 / 忘记密码重置。
 */
@RestController
@RequestMapping("/user")
public class EmailCodeController {

    private static final Pattern PASSWORD_PATTERN =
            Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d)\\S{6,30}$");

    @Resource
    private EmailCodeService emailCodeService;

    @Resource
    private UserMapper userMapper;

    private String value(Map<String, String> body, String key) {
        return body == null || body.get(key) == null ? "" : body.get(key).trim();
    }

    /** 发送邮箱验证码（scene：register / reset） */
    @PostMapping("/email-code")
    public Result<?> sendCode(@RequestBody Map<String, String> body) {
        String email = value(body, "email");
        String scene = value(body, "scene");
        try {
            return Result.success(emailCodeService.send(email, scene.isEmpty() ? "register" : scene));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return Result.error("-1", e.getMessage());
        } catch (Exception e) {
            return Result.error("-1", "验证码发送失败：" + e.getMessage());
        }
    }

    /** 校验邮箱验证码 */
    @PostMapping("/verify-code")
    public Result<?> verifyCode(@RequestBody Map<String, String> body) {
        String email = value(body, "email");
        String scene = value(body, "scene");
        String code = value(body, "code");
        try {
            emailCodeService.verify(email, scene.isEmpty() ? "register" : scene, code);
            return Result.success("验证成功");
        } catch (IllegalStateException e) {
            return Result.error("-1", e.getMessage());
        }
    }

    /** 忘记密码：邮箱验证码 + 新密码 */
    @PostMapping("/reset-password")
    public Result<?> resetPassword(@RequestBody Map<String, String> body) {
        String email = value(body, "email");
        String code = value(body, "code");
        String newPassword = body == null || body.get("newPassword") == null ? "" : body.get("newPassword");
        if (!emailCodeService.isValidEmail(email)) {
            return Result.error("-1", "邮箱格式不正确");
        }
        if (!PASSWORD_PATTERN.matcher(newPassword).matches()) {
            return Result.error("-1", "密码需为 6-30 位，且同时包含字母和数字");
        }
        User user = userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getEmail, email));
        if (user == null) {
            return Result.error("-1", "该邮箱未绑定任何账号");
        }
        try {
            emailCodeService.verify(email, "reset", code);
        } catch (IllegalStateException e) {
            return Result.error("-1", e.getMessage());
        }
        user.setPassword(newPassword);
        userMapper.updateById(user);
        return Result.success("密码重置成功，请使用新密码登录");
    }
}
