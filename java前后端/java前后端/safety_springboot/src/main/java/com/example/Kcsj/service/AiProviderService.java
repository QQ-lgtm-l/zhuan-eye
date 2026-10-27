package com.example.Kcsj.service;

import org.springframework.stereotype.Service;

import java.util.*;

/**
 * AI 模型通道配置中心。
 *
 * 优先级：
 * 1. 页面运行时配置（只存内存，重启失效）；
 * 2. 环境变量（DASHSCOPE_API_KEY / DEEPSEEK_API_KEY / KIMI_API_KEY / ARK_API_KEY / COZE_API_KEY ...）；
 * 3. 内置知识手册。
 *
 * 任何情况下都不会把完整 Key 返回给前端，也不会写日志/落盘。
 */
@Service
public class AiProviderService {

    public static class Preset {
        final String id;
        final String name;
        final String baseUrl;
        final String model;
        final String keyEnv;
        final String description;
        final boolean coze;

        Preset(String id, String name, String baseUrl, String model, String keyEnv, String description, boolean coze) {
            this.id = id;
            this.name = name;
            this.baseUrl = baseUrl;
            this.model = model;
            this.keyEnv = keyEnv;
            this.description = description;
            this.coze = coze;
        }
    }

    private static final List<Preset> PRESETS = Arrays.asList(
            new Preset("dashscope", "通义千问", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                    "qwen-plus", "DASHSCOPE_API_KEY", "阿里云百炼，OpenAI 兼容", false),
            new Preset("deepseek", "DeepSeek", "https://api.deepseek.com/chat/completions",
                    "deepseek-chat", "DEEPSEEK_API_KEY", "DeepSeek 官方接口", false),
            new Preset("kimi", "Kimi（Moonshot）", "https://api.moonshot.cn/v1/chat/completions",
                    "moonshot-v1-8k", "KIMI_API_KEY", "月之暗面 Kimi", false),
            new Preset("doubao", "豆包（火山方舟）", "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
                    "", "ARK_API_KEY", "需要填写接入点 ID 作为模型名", false),
            new Preset("coze", "扣子 Coze 智能体", "https://api.coze.cn",
                    "Coze 智能体", "COZE_API_KEY", "需要 PAT + Bot ID", true),
            new Preset("custom", "自定义（OpenAI 兼容）", "", "",
                    "AI_CHAT_API_KEY", "自行填写 Base URL / 模型 / Key", false)
    );

    private static final Preset LOCAL = new Preset("local", "内置知识手册", "", "内置房建安全知识手册", "", "离线可用", false);

    public static class Resolved {
        public String mode = "local";       // local / online / coze
        public String providerId = "local";
        public String providerName = "内置知识手册";
        public String baseUrl = "";
        public String model = "";
        public String apiKey = "";
        public String botId = "";
        public String userId = "";
    }

    private static class Runtime {
        String providerId = "";
        String baseUrl = "";
        String model = "";
        String apiKey = "";
        String botId = "";
        String userId = "";
    }

    private volatile Runtime runtime = new Runtime();

    private Preset find(String id) {
        if (id == null) return null;
        for (Preset p : PRESETS) {
            if (p.id.equalsIgnoreCase(id)) return p;
        }
        return null;
    }

    private String env(String... names) {
        for (String name : names) {
            String value = System.getenv(name);
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    private String envKey(Preset preset) {
        if (preset == null) return "";
        switch (preset.id) {
            case "dashscope": return env("DASHSCOPE_API_KEY");
            case "deepseek": return env("DEEPSEEK_API_KEY");
            case "kimi": return env("KIMI_API_KEY", "MOONSHOT_API_KEY");
            case "doubao": return env("ARK_API_KEY", "DOUBAO_API_KEY");
            case "coze": return env("COZE_API_KEY", "COZE_API_TOKEN");
            case "custom": return env("AI_CHAT_API_KEY");
            default: return "";
        }
    }

    private String envBotId() {
        return env("COZE_BOT_ID");
    }

    private String envUserId() {
        String value = env("COZE_USER_ID");
        return value.isEmpty() ? "zhuan-eye-web" : value;
    }

    /** 当前实际生效的通道 */
    public Resolved resolve() {
        Runtime rt = runtime;
        if (rt != null && rt.providerId != null && !rt.providerId.isEmpty() && !"local".equals(rt.providerId)) {
            Resolved resolved = build(find(rt.providerId), rt);
            if (resolved != null) return resolved;
        }
        // 自动：按环境变量优先级选择
        for (String id : Arrays.asList("dashscope", "deepseek", "kimi", "doubao")) {
            Preset preset = find(id);
            String key = envKey(preset);
            if (!key.isEmpty()) {
                Runtime auto = new Runtime();
                auto.providerId = preset.id;
                Resolved resolved = build(preset, auto);
                if (resolved != null) return resolved;
            }
        }
        Preset coze = find("coze");
        if (!envKey(coze).isEmpty() && !envBotId().isEmpty()) {
            Runtime auto = new Runtime();
            auto.providerId = "coze";
            Resolved resolved = build(coze, auto);
            if (resolved != null) return resolved;
        }
        Resolved local = new Resolved();
        local.mode = "local";
        local.providerId = "local";
        local.providerName = "内置知识手册";
        local.model = "内置房建安全知识手册";
        return local;
    }

    private Resolved build(Preset preset, Runtime rt) {
        if (preset == null) return null;
        String key = rt.apiKey != null && !rt.apiKey.isEmpty() ? rt.apiKey : envKey(preset);
        if (key.isEmpty()) return null;

        Resolved resolved = new Resolved();
        resolved.providerId = preset.id;
        resolved.providerName = preset.name;
        resolved.baseUrl = rt.baseUrl != null && !rt.baseUrl.isEmpty() ? rt.baseUrl : preset.baseUrl;
        resolved.model = rt.model != null && !rt.model.isEmpty() ? rt.model : preset.model;
        resolved.apiKey = key;

        if (preset.coze) {
            String botId = rt.botId != null && !rt.botId.isEmpty() ? rt.botId : envBotId();
            if (botId.isEmpty()) return null;
            resolved.botId = botId;
            resolved.userId = rt.userId != null && !rt.userId.isEmpty() ? rt.userId : envUserId();
            resolved.mode = "coze";
            resolved.baseUrl = resolved.baseUrl == null || resolved.baseUrl.isEmpty() ? "https://api.coze.cn" : resolved.baseUrl;
        } else {
            if (resolved.baseUrl == null || resolved.baseUrl.isEmpty()) return null;
            resolved.mode = "online";
        }
        return resolved;
    }

    /** 前端厂商下拉列表（不返回任何 Key） */
    public List<Map<String, Object>> list() {
        Resolved active = resolve();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Preset preset : PRESETS) {
            String key = envKey(preset);
            boolean runtimeActive = runtime != null && preset.id.equals(runtime.providerId);
            boolean configured = !key.isEmpty() || (runtimeActive && runtime.apiKey != null && !runtime.apiKey.isEmpty());
            if (preset.coze) {
                configured = configured && (!envBotId().isEmpty()
                        || (runtimeActive && runtime.botId != null && !runtime.botId.isEmpty()));
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", preset.id);
            row.put("name", preset.name);
            row.put("baseUrl", preset.baseUrl);
            row.put("model", preset.model);
            row.put("keyEnv", preset.keyEnv);
            row.put("description", preset.description);
            row.put("requiresBot", preset.coze);
            row.put("configured", configured);
            row.put("active", preset.id.equals(active.providerId));
            result.add(row);
        }
        Map<String, Object> local = new LinkedHashMap<>();
        local.put("id", LOCAL.id);
        local.put("name", LOCAL.name);
        local.put("description", LOCAL.description);
        local.put("configured", true);
        local.put("active", "local".equals(active.providerId));
        local.put("requiresBot", false);
        result.add(local);
        return result;
    }

    /** 当前状态（前端显示标签用） */
    public Map<String, Object> status() {
        Resolved resolved = resolve();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("online", !"local".equals(resolved.mode));
        data.put("mode", resolved.mode);
        data.put("provider", resolved.providerId);
        data.put("providerLabel", resolved.providerName);
        data.put("model", resolved.model == null || resolved.model.isEmpty() ? "内置房建安全知识手册" : resolved.model);
        List<String> configured = new ArrayList<>();
        for (Preset preset : PRESETS) {
            if (!envKey(preset).isEmpty()) configured.add(preset.id);
        }
        data.put("configuredProviders", configured);
        data.put("runtimeActive", runtime != null && runtime.providerId != null && !runtime.providerId.isEmpty());
        return data;
    }

    /** 页面保存配置（内存） */
    public Map<String, Object> apply(Map<String, Object> body) {
        String providerId = string(body, "provider");
        if (providerId.isEmpty() || "local".equalsIgnoreCase(providerId)) {
            runtime = new Runtime();
            return status();
        }
        Preset preset = find(providerId);
        if (preset == null) {
            throw new IllegalArgumentException("未知的模型厂商：" + providerId);
        }
        Runtime next = new Runtime();
        next.providerId = preset.id;
        next.apiKey = string(body, "apiKey");
        next.model = string(body, "model");
        next.baseUrl = string(body, "baseUrl");
        next.botId = string(body, "botId");
        next.userId = string(body, "userId");

        String key = !next.apiKey.isEmpty() ? next.apiKey : envKey(preset);
        if (key.isEmpty()) {
            throw new IllegalArgumentException("请填写 API Key，或先配置环境变量 " + preset.keyEnv);
        }
        if (preset.coze) {
            String botId = !next.botId.isEmpty() ? next.botId : envBotId();
            if (botId.isEmpty()) {
                throw new IllegalArgumentException("扣子需要填写 Bot ID，或配置环境变量 COZE_BOT_ID");
            }
        }
        runtime = next;
        return status();
    }

    public void reset() {
        runtime = new Runtime();
    }

    private String string(Map<String, Object> body, String key) {
        if (body == null || body.get(key) == null) return "";
        return String.valueOf(body.get(key)).trim();
    }
}
