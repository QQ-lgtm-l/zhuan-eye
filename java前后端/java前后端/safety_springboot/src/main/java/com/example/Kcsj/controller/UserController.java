package com.example.Kcsj.controller;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.mapper.UserMapper;
import com.example.Kcsj.service.EmailCodeService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Date;
import java.util.Objects;

@RestController
@RequestMapping("/user")
public class UserController {
    @Resource
    UserMapper userMapper;

    @Resource
    EmailCodeService emailCodeService;

    /** 是否强制注册前完成邮箱验证（默认关闭，避免影响小程序等未接验证码的客户端） */
    @Value("${app.mail.require-code:false}")
    private boolean requireEmailCode;

    /**
     * 用户分页列表查询，包含表的一对多查询
     *
     * @param pageNum
     * @param pageSize
     * @param search
     * @return
     */
    @GetMapping
    public Result<?> findPage(@RequestParam(defaultValue = "1") Integer pageNum,
                              @RequestParam(defaultValue = "10") Integer pageSize,
                              @RequestParam(defaultValue = "") String search) {
        LambdaQueryWrapper<User> wrapper = Wrappers.<User>lambdaQuery();
        wrapper.orderByDesc(User::getId);
        if (StrUtil.isNotBlank(search)) {
            wrapper.like(User::getUsername, search);
        }
        Page<User> UserPage = userMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return Result.success(UserPage);
    }

    @GetMapping("/{username}")
    public Result<?> getByUsername(@PathVariable String username) {
        System.out.println(username);
        return Result.success(userMapper.selectByUsername(username));
    }

    @GetMapping("/all")
    public Result<?> GetAll() {
        return Result.success(userMapper.selectList(null));
    }

    @PostMapping("/login")
    public Result<?> login(@RequestBody User userParam) {
        System.out.println(userParam);
        try{
            User userPwd = userMapper.selectByName(userParam.getUsername());
            QueryWrapper<User> queryWrapper = new QueryWrapper<>();
            queryWrapper.eq("username", userParam.getUsername());
            queryWrapper.eq("password", userPwd.getPassword());
            User res = userMapper.selectOne(queryWrapper);
            if (!Objects.equals(userParam.getPassword(), userPwd.getPassword())) {
                return Result.error("-1", "密码错误！");
            } else {
                // 登录不再要求选择角色，角色以数据库为准（避免选错角色登不上去）
                return Result.success(res);
            }
        }catch (Exception e){
            return Result.error("-1", "用户名不存在！");
        }
    }

    /**
     * 邮箱 / 手机号唯一性校验。
     * 注册、管理员新增必须唯一；修改资料时只有「真正改动了」才校验，
     * 避免历史重复数据导致用户改个姓名就被拦住。
     */
    private Result<?> checkContactDuplicate(String email, String tel, Integer excludeId,
                                            String currentEmail, String currentTel) {
        String normalizedEmail = email == null ? "" : email.trim();
        String normalizedTel = tel == null ? "" : tel.trim();
        String oldEmail = currentEmail == null ? "" : currentEmail.trim();
        String oldTel = currentTel == null ? "" : currentTel.trim();

        if (StrUtil.isNotBlank(normalizedEmail) && !normalizedEmail.equalsIgnoreCase(oldEmail)) {
            QueryWrapper<User> wrapper = new QueryWrapper<>();
            wrapper.eq("email", normalizedEmail);
            if (excludeId != null) wrapper.ne("id", excludeId);
            if (userMapper.selectCount(wrapper) > 0) {
                return Result.error("-1", "该邮箱已被其他账号使用，请更换邮箱");
            }
        }
        if (StrUtil.isNotBlank(normalizedTel) && !normalizedTel.equals(oldTel)) {
            QueryWrapper<User> wrapper = new QueryWrapper<>();
            wrapper.eq("tel", normalizedTel);
            if (excludeId != null) wrapper.ne("id", excludeId);
            if (userMapper.selectCount(wrapper) > 0) {
                return Result.error("-1", "该手机号已被其他账号使用，请更换手机号");
            }
        }
        return null;
    }

    @PostMapping("/register")
    public Result<?> register(@RequestBody User user) {
        user.setUsername(user.getUsername() == null ? null : user.getUsername().trim());
        user.setEmail(user.getEmail() == null ? "" : user.getEmail().trim());
        user.setTel(user.getTel() == null ? "" : user.getTel().trim());
        if (StrUtil.isBlank(user.getUsername())) {
            return Result.error("-1", "请输入账号");
        }
        if (StrUtil.isBlank(user.getPassword())) {
            return Result.error("-1", "请输入密码");
        }
        if (StrUtil.isNotBlank(user.getEmail()) && !emailCodeService.isValidEmail(user.getEmail())) {
            return Result.error("-1", "邮箱格式不正确");
        }
        if (requireEmailCode && StrUtil.isNotBlank(user.getEmail())) {
            if (!emailCodeService.consumeVerified(user.getEmail(), "register")) {
                return Result.error("-1", "请先完成邮箱验证码验证");
            }
        }
        User res = userMapper.selectOne(Wrappers.<User>lambdaQuery().eq(User::getUsername, user.getUsername()));
        if (res != null) {
            return Result.error("-1", "用户名重复");
        }
        Result<?> contactCheck = checkContactDuplicate(user.getEmail(), user.getTel(), null, null, null);
        if (contactCheck != null) {
            return contactCheck;
        }

        User user1 = new User();
        user1.setUsername(user.getUsername());
        user1.setPassword(user.getPassword());
        user1.setName(user.getName() != null ? user.getName() : "");
        user1.setSex(user.getSex() != null ? user.getSex() : "");
        user1.setRole(user.getRole() != null ? user.getRole() : "现场施工人员");
        user1.setEmail(user.getEmail());
        user1.setTime(new Date());
        user1.setTel(user.getTel());
        user1.setAvatar(user.getAvatar() != null ? user.getAvatar() : "https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif");

        userMapper.insert(user1);
        return Result.success(user1);
    }
    @PostMapping("/update")
    public Result<?> updates(@RequestBody User user) {
        User existing = user.getId() == null ? null : userMapper.selectById(user.getId());
        if (existing != null) {
            if (user.getEmail() != null && !user.getEmail().trim().equalsIgnoreCase(
                    existing.getEmail() == null ? "" : existing.getEmail().trim())
                    && !emailCodeService.isValidEmail(user.getEmail().trim())) {
                return Result.error("-1", "邮箱格式不正确");
            }
            Result<?> contactCheck = checkContactDuplicate(
                    user.getEmail(), user.getTel(), existing.getId(), existing.getEmail(), existing.getTel());
            if (contactCheck != null) {
                return contactCheck;
            }
        }
        if (user.getEmail() != null) user.setEmail(user.getEmail().trim());
        if (user.getTel() != null) user.setTel(user.getTel().trim());
        // 密码留空表示不修改，避免 updateById 把密码覆盖成空串
        if (StrUtil.isBlank(user.getPassword())) {
            user.setPassword(null);
        }
        userMapper.updateById(user);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable int id) {
        userMapper.deleteById(id);
        return Result.success();
    }
    @PostMapping
    public Result<?> save(@RequestBody User user) {
        if (user.getEmail() != null) user.setEmail(user.getEmail().trim());
        if (user.getTel() != null) user.setTel(user.getTel().trim());
        if (StrUtil.isBlank(user.getUsername())) {
            return Result.error("-1", "请输入账号");
        }
        if (StrUtil.isBlank(user.getPassword())) {
            return Result.error("-1", "请输入密码");
        }
        if (StrUtil.isNotBlank(user.getEmail()) && !emailCodeService.isValidEmail(user.getEmail())) {
            return Result.error("-1", "邮箱格式不正确");
        }
        Result<?> contactCheck = checkContactDuplicate(user.getEmail(), user.getTel(), null, null, null);
        if (contactCheck != null) {
            return contactCheck;
        }
        userMapper.insert(user);
        return Result.success();
    }
}
