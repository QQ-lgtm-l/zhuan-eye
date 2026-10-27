package com.example.Kcsj.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 房建安全知识手册：分类知识库 + 问答检索。
 *
 * 数据来源：classpath:safety_knowledge.json（32 条，覆盖 22 类隐患 + 通用安全管理）。
 * 不依赖任何外部大模型，可离线使用。
 */
@Service
public class SafetyKnowledgeService {

    private static final Logger log = LoggerFactory.getLogger(SafetyKnowledgeService.class);

    private JSONArray categories = new JSONArray();
    private JSONArray items = new JSONArray();
    private final Map<String, String> categoryNames = new LinkedHashMap<>();

    @PostConstruct
    public void load() {
        try (InputStream input = new ClassPathResource("safety_knowledge.json").getInputStream()) {
            String text = new String(input.readAllBytes(), StandardCharsets.UTF_8);
            JSONObject root = JSON.parseObject(text);
            categories = root.getJSONArray("categories");
            items = root.getJSONArray("items");
            for (int i = 0; i < categories.size(); i++) {
                JSONObject category = categories.getJSONObject(i);
                categoryNames.put(category.getString("key"), category.getString("name"));
            }
            log.info("房建安全知识手册加载完成：{} 个分类，{} 条知识", categories.size(), items.size());
        } catch (Exception e) {
            log.error("加载安全知识手册失败: {}", e.getMessage(), e);
            categories = new JSONArray();
            items = new JSONArray();
        }
    }

    public List<Map<String, Object>> listCategories() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < categories.size(); i++) {
            JSONObject category = categories.getJSONObject(i);
            String key = category.getString("key");
            int count = 0;
            for (int j = 0; j < items.size(); j++) {
                if (key.equals(items.getJSONObject(j).getString("category"))) count++;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", key);
            row.put("name", category.getString("name"));
            row.put("desc", category.getString("desc"));
            row.put("count", count);
            result.add(row);
        }
        return result;
    }

    public List<Map<String, Object>> listItems(String category, String keyword) {
        String cat = trim(category);
        String kw = trim(keyword).toLowerCase();
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            JSONObject item = items.getJSONObject(i);
            if (!cat.isEmpty() && !cat.equals(item.getString("category"))) continue;
            if (!kw.isEmpty() && !matches(item, kw)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getString("id"));
            row.put("name", item.getString("name"));
            row.put("category", item.getString("category"));
            row.put("categoryName", categoryNames.getOrDefault(item.getString("category"), ""));
            row.put("risk", item.getString("risk"));
            row.put("summary", item.getString("suggestion"));
            row.put("basis", item.getString("basis"));
            result.add(row);
        }
        return result;
    }

    public Map<String, Object> detail(String id) {
        JSONObject item = findById(id);
        if (item == null) return null;
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getString("id"));
        row.put("name", item.getString("name"));
        row.put("category", item.getString("category"));
        row.put("categoryName", categoryNames.getOrDefault(item.getString("category"), ""));
        row.put("risk", item.getString("risk"));
        row.put("basis", item.getString("basis"));
        row.put("suggestion", item.getString("suggestion"));
        row.put("handle", item.getString("handle"));
        row.put("prevent", item.getString("prevent"));
        row.put("checkpoints", item.getJSONArray("checkpoints"));
        row.put("keywords", item.getJSONArray("keywords"));
        return row;
    }

    public Map<String, Object> stats() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", items.size());
        data.put("categories", listCategories());
        return data;
    }

    /** 问答检索：关键词加权匹配 → 分类概览 → 手册总览 */
    public Map<String, Object> ask(String question) {
        String q = question == null ? "" : question.trim();
        JSONObject best = null;
        int bestScore = 0;
        for (int i = 0; i < items.size(); i++) {
            JSONObject item = items.getJSONObject(i);
            int score = 0;
            JSONArray keywords = item.getJSONArray("keywords");
            for (int k = 0; keywords != null && k < keywords.size(); k++) {
                String keyword = keywords.getString(k);
                if (!keyword.isEmpty() && q.contains(keyword)) score += keyword.length() * 10;
            }
            String name = item.getString("name");
            if (name != null && q.contains(name)) score += name.length() * 5;
            if (score > bestScore) {
                bestScore = score;
                best = item;
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        if (best != null) {
            data.put("content", answerText(best));
            data.put("source", "local");
            data.put("model", "内置房建安全知识手册");
            data.put("provider", "local");
            data.put("itemId", best.getString("id"));
            return data;
        }
        // 没匹配到具体条目：看是否问某个分类
        for (int i = 0; i < categories.size(); i++) {
            JSONObject category = categories.getJSONObject(i);
            String name = category.getString("name");
            if (name != null && (q.contains(name) || q.contains(name.replace("类", "")))) {
                data.put("content", categoryText(category));
                data.put("source", "local");
                data.put("model", "内置房建安全知识手册");
                data.put("provider", "local");
                return data;
            }
        }
        data.put("content", overviewText());
        data.put("source", "local");
        data.put("model", "内置房建安全知识手册");
        data.put("provider", "local");
        return data;
    }

    private String answerText(JSONObject item) {
        StringBuilder sb = new StringBuilder();
        sb.append("### ").append(item.getString("name")).append("\n\n");
        sb.append("**隐患类别**：").append(categoryNames.getOrDefault(item.getString("category"), "通用")).append("\n\n");
        sb.append("**风险等级**：").append(item.getString("risk")).append("\n\n");
        sb.append("**整改建议**：").append(item.getString("suggestion")).append("\n\n");
        sb.append("**处理方法**：").append(item.getString("handle")).append("\n\n");
        sb.append("**预防措施**：").append(item.getString("prevent")).append("\n\n");
        JSONArray checkpoints = item.getJSONArray("checkpoints");
        if (checkpoints != null && !checkpoints.isEmpty()) {
            sb.append("**现场检查要点**：\n");
            for (int i = 0; i < checkpoints.size(); i++) {
                sb.append("- ").append(checkpoints.getString(i)).append("\n");
            }
            sb.append("\n");
        }
        sb.append("**规范依据**：").append(item.getString("basis")).append("\n\n");
        sb.append("> 以上内容来自内置《房建安全知识手册》，仅供参考，具体以现行规范原文及项目专项方案为准。");
        return sb.toString();
    }

    private String categoryText(JSONObject category) {
        String key = category.getString("key");
        StringBuilder sb = new StringBuilder();
        sb.append("### ").append(category.getString("name")).append("\n\n");
        sb.append(category.getString("desc")).append("\n\n");
        sb.append("**包含以下条目**：\n\n");
        for (int i = 0; i < items.size(); i++) {
            JSONObject item = items.getJSONObject(i);
            if (!key.equals(item.getString("category"))) continue;
            sb.append("- ").append(item.getString("name")).append("（").append(item.getString("risk")).append("）\n");
        }
        sb.append("\n> 可以直接提问具体条目，例如「").append(firstItemName(key)).append("怎么整改」。");
        return sb.toString();
    }

    private String firstItemName(String categoryKey) {
        for (int i = 0; i < items.size(); i++) {
            JSONObject item = items.getJSONObject(i);
            if (categoryKey.equals(item.getString("category"))) return item.getString("name");
        }
        return "该分类隐患";
    }

    private String overviewText() {
        StringBuilder sb = new StringBuilder();
        sb.append("### 房建安全知识手册\n\n");
        sb.append("本手册收录 **").append(items.size()).append("** 条房建施工现场安全知识，分为 **")
                .append(categories.size()).append("** 大类：\n\n");
        for (int i = 0; i < categories.size(); i++) {
            JSONObject category = categories.getJSONObject(i);
            int count = 0;
            for (int j = 0; j < items.size(); j++) {
                if (category.getString("key").equals(items.getJSONObject(j).getString("category"))) count++;
            }
            sb.append("- **").append(category.getString("name")).append("**（").append(count).append(" 条）：")
                    .append(category.getString("desc")).append("\n");
        }
        sb.append("\n你可以这样提问：\n\n");
        sb.append("- 未佩戴安全帽属于什么风险等级、如何整改？\n");
        sb.append("- 高处作业安全带系挂有哪些要求？\n");
        sb.append("- 临时用电配电箱防护有什么规定？\n");
        sb.append("- 危大工程需要哪些资料？\n\n");
        sb.append("> 当前未接入外部大模型，回答来自内置知识手册；也可以打开「安全知识手册」页面按分类浏览。");
        return sb.toString();
    }

    private boolean matches(JSONObject item, String keyword) {
        if (contains(item.getString("name"), keyword)) return true;
        if (contains(item.getString("suggestion"), keyword)) return true;
        if (contains(item.getString("basis"), keyword)) return true;
        JSONArray keywords = item.getJSONArray("keywords");
        for (int i = 0; keywords != null && i < keywords.size(); i++) {
            if (contains(keywords.getString(i), keyword)) return true;
        }
        return false;
    }

    private boolean contains(String text, String keyword) {
        return text != null && text.toLowerCase().contains(keyword);
    }

    private JSONObject findById(String id) {
        for (int i = 0; i < items.size(); i++) {
            JSONObject item = items.getJSONObject(i);
            if (item.getString("id").equals(id)) return item;
        }
        return null;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
