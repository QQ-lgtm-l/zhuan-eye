package com.example.Kcsj.controller;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.example.Kcsj.common.PinyinUtils;
import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.mapper.UserMapper;
import com.example.Kcsj.service.PhoneCodeService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 极简注册：姓名 + 手机号 + 验证码。
 *
 * 账号自动取姓名全拼（重名追加数字），初始密码为手机号后 6 位，
 * 其他信息使用默认值，登录后可在个人中心修改。
 */
@RestController
@RequestMapping("/user")
public class QuickRegisterController {

    @Resource
    private UserMapper userMapper;

    @Resource
    private PhoneCodeService phoneCodeService;

    private String value(Map<String, String> body, String key) {
        return body == null || body.get(key) == null ? "" : body.get(key).trim();
    }

    /** 获取手机验证码（演示模式直接返回） */
    @PostMapping("/phone-code")
    public Result<?> sendPhoneCode(@RequestBody Map<String, String> body) {
        try {
            return Result.success(phoneCodeService.send(value(body, "phone")));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return Result.error("-1", e.getMessage());
        } catch (Exception e) {
            return Result.error("-1", "验证码发送失败：" + e.getMessage());
        }
    }

    /** 极简注册 */
    @PostMapping("/quick-register")
    public Result<?> quickRegister(@RequestBody Map<String, String> body) {
        String name = value(body, "name");
        String phone = value(body, "phone");
        String code = value(body, "code");

        if (name.isEmpty() || name.length() > 20) {
            return Result.error("-1", "请输入姓名（1-20 个字符）");
        }
        if (!phoneCodeService.isValidPhone(phone)) {
            return Result.error("-1", "手机号格式不正确");
        }
        if (userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getTel, phone)) > 0) {
            return Result.error("-1", "该手机号已注册，请直接登录");
        }
        try {
            phoneCodeService.check(phone, code);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return Result.error("-1", e.getMessage());
        }

        String role = value(body, "role");
        if (role.isEmpty()) {
            role = "现场施工人员";
        }
        if (!java.util.Arrays.asList("项目经理", "专职安全员", "巡检员", "施工班组长", "现场施工人员").contains(role)) {
            return Result.error("-1", "请选择正确的职位");
        }

        String username = generateUsername(name, phone);
        String password = "123456";

        User user = new User();
        user.setUsername(username);
        user.setPassword(password);
        user.setName(name);
        user.setSex("");
        user.setEmail("");
        user.setTel(phone);
        user.setRole(role);
        user.setTime(new Date());
        user.setAvatar("");
        userMapper.insert(user);
        phoneCodeService.consume(phone, code);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", user.getId());
        data.put("username", username);
        data.put("password", password);
        data.put("name", name);
        data.put("role", user.getRole());
        data.put("message", "注册成功，请使用账号和初始密码登录");
        return Result.success(data);
    }

    /** 姓名全拼生成账号，重名自动追加 2、3… */
    private String generateUsername(String name, String phone) {
        String base = PinyinUtils.toPinyin(name);
        if (base.isEmpty()) {
            base = "user" + phone.substring(phone.length() - 4);
        }
        String candidate = base;
        int suffix = 2;
        while (userMapper.selectCount(Wrappers.<User>lambdaQuery().eq(User::getUsername, candidate)) > 0) {
            candidate = base + suffix;
            suffix++;
            if (suffix > 999) {
                candidate = base + phone.substring(phone.length() - 4);
                break;
            }
        }
        return candidate;
    }
}
