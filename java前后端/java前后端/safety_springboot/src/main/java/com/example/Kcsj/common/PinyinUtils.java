package com.example.Kcsj.common;

import net.sourceforge.pinyin4j.PinyinHelper;
import net.sourceforge.pinyin4j.format.HanyuPinyinCaseType;
import net.sourceforge.pinyin4j.format.HanyuPinyinOutputFormat;
import net.sourceforge.pinyin4j.format.HanyuPinyinToneType;

/**
 * 姓名转拼音：用于把中文姓名生成登录账号。
 * 例如 张三 -> zhangsan，李小龙 -> lixiaolong；英文/数字保留，其他符号忽略。
 */
public final class PinyinUtils {

    private static final HanyuPinyinOutputFormat FORMAT = new HanyuPinyinOutputFormat();

    static {
        FORMAT.setCaseType(HanyuPinyinCaseType.LOWERCASE);
        FORMAT.setToneType(HanyuPinyinToneType.WITHOUT_TONE);
    }

    private PinyinUtils() {
    }

    public static String toPinyin(String text) {
        if (text == null) return "";
        StringBuilder builder = new StringBuilder();
        for (char ch : text.toCharArray()) {
            if (ch < 128) {
                if (Character.isLetterOrDigit(ch)) {
                    builder.append(Character.toLowerCase(ch));
                }
                continue;
            }
            try {
                String[] pinyin = PinyinHelper.toHanyuPinyinStringArray(ch, FORMAT);
                if (pinyin != null && pinyin.length > 0) {
                    builder.append(pinyin[0]);
                }
            } catch (Exception ignored) {
                // 生僻字/无法转换的字符直接跳过
            }
        }
        String result = builder.toString().replaceAll("[^a-z0-9]", "");
        return result.length() > 20 ? result.substring(0, 20) : result;
    }
}
