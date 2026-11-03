package com.example.Kcsj.common;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.entity.WorkOrder;
import com.example.Kcsj.mapper.UserMapper;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.List;

/**
 * 按隐患等级选择“主责账号”。
 * 当前没有项目/区域/班组字段，先用角色 + 演示账号固定映射；
 * 后续接入项目/区域后，把 pick 改成按项目成员表选择即可。
 */
@Component
public class WorkOrderAssigneeService {

    @Resource
    private UserMapper userMapper;

    public WorkOrder apply(WorkOrder order) {
        if (order == null) return null;
        if (order.getAssigneeId() != null && order.getAssigneeRole() != null) {
            return order;
        }
        String level = HazardLevel.normalize(order.getLevel());
        User user = pick(level);
        if (user != null) {
            order.setAssigneeId(user.getId());
            order.setAssigneeName(user.getName() != null ? user.getName() : user.getUsername());
            order.setAssigneeRole(user.getRole());
        }
        return order;
    }

    public User pick(String level) {
        String role = roleForLevel(level);
        String preferredUsername = preferredUsername(role);
        if (preferredUsername != null) {
            User preferred = userMapper.selectList(Wrappers.<User>lambdaQuery()
                            .eq(User::getUsername, preferredUsername)
                            .last("limit 1"))
                    .stream().findFirst().orElse(null);
            if (preferred != null) return preferred;
        }
        List<User> users = userMapper.selectList(Wrappers.<User>lambdaQuery()
                .eq(User::getRole, role)
                .orderByAsc(User::getId)
                .last("limit 1"));
        return users.isEmpty() ? null : users.get(0);
    }

    public static String roleForLevel(String level) {
        String normalized = HazardLevel.normalize(level);
        if (normalized.startsWith("Ⅰ")) return "项目经理";
        if (normalized.startsWith("Ⅱ")) return "专职安全员";
        if (normalized.startsWith("Ⅳ")) return "现场施工人员";
        return "施工班组长";
    }

    private static String preferredUsername(String role) {
        switch (role) {
            case "项目经理": return "wangjianguo";
            case "专职安全员": return "zhaomin";
            case "施工班组长": return "zhuqiang";
            case "现场施工人员": return "hejing";
            default: return null;
        }
    }
}
