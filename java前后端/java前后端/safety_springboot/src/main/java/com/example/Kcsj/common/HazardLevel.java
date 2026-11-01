package com.example.Kcsj.common;

import java.util.Arrays;
import java.util.List;

/**
 * 四级隐患统一口径（与 业务规则改造记录.md 保持一致）。
 * 旧数据里的“重大隐患/较大隐患/一般隐患/轻微隐患”统一归一化。
 */
public final class HazardLevel {

    public static final String L1 = "Ⅰ级重大";
    public static final String L2 = "Ⅱ级较大";
    public static final String L3 = "Ⅲ级一般";
    public static final String L4 = "Ⅳ级轻微";

    private HazardLevel() {
    }

    public static String normalize(String level) {
        if (level == null) {
            return L3;
        }
        String text = level.trim();
        if (L1.equals(text) || L2.equals(text) || L3.equals(text) || L4.equals(text)) {
            return text;
        }
        if (text.contains("重大") || text.contains("Ⅰ")) {
            return L1;
        }
        if (text.contains("较大") || text.contains("Ⅱ")) {
            return L2;
        }
        if (text.contains("轻微") || text.contains("Ⅳ")) {
            return L4;
        }
        return L3;
    }

    public static String code(String level) {
        String normalized = normalize(level);
        if (L1.equals(normalized)) return "Ⅰ";
        if (L2.equals(normalized)) return "Ⅱ";
        if (L3.equals(normalized)) return "Ⅲ";
        return "Ⅳ";
    }

    public static String responseTimeout(String level) {
        String normalized = normalize(level);
        if (L1.equals(normalized)) return "0.5小时";
        if (L2.equals(normalized)) return "4小时";
        return "24小时";
    }

    public static String rectifyTimeout(String level) {
        String normalized = normalize(level);
        if (L1.equals(normalized)) return "24小时";
        if (L2.equals(normalized)) return "48小时";
        if (L3.equals(normalized)) return "7天";
        return "3天";
    }

    public static int responseMinutes(String level) {
        String normalized = normalize(level);
        if (L1.equals(normalized)) return 30;
        if (L2.equals(normalized)) return 240;
        return 1440;
    }

    public static int rectifyMinutes(String level) {
        String normalized = normalize(level);
        if (L1.equals(normalized)) return 24 * 60;
        if (L2.equals(normalized)) return 48 * 60;
        if (L3.equals(normalized)) return 7 * 24 * 60;
        return 3 * 24 * 60;
    }

    public static String defaultResponsible(String level) {
        String normalized = normalize(level);
        if (L1.equals(normalized)) return "项目经理+专职安全员+施工班组长";
        if (L2.equals(normalized)) return "专职安全员+施工班组长";
        if (L3.equals(normalized)) return "专职安全员+施工班组长";
        return "施工班组长+现场施工人员";
    }

    public static List<String> pushRoles(String level) {
        String normalized = normalize(level);
        if (L1.equals(normalized)) {
            return Arrays.asList("管理员", "项目经理", "专职安全员");
        }
        if (L2.equals(normalized)) {
            return Arrays.asList("项目经理", "专职安全员", "巡检员");
        }
        if (L3.equals(normalized)) {
            return Arrays.asList("专职安全员", "巡检员", "施工班组长");
        }
        return Arrays.asList("巡检员", "施工班组长", "现场施工人员");
    }
}
