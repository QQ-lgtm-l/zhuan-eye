package com.example.Kcsj.controller;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.example.Kcsj.common.Result;
import com.example.Kcsj.service.AiProviderService;
import com.example.Kcsj.service.SafetyKnowledgeService;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.util.*;

/**
 * 智能问答：扣子智能体 / 任意 OpenAI 兼容在线模型 / 内置知识手册。
 *
 * 模型配置优先级：页面运行时配置（内存） > 环境变量 > 内置知识手册。
 * 支持环境变量：DASHSCOPE_API_KEY、DEEPSEEK_API_KEY、KIMI_API_KEY、
 * ARK_API_KEY、COZE_API_KEY（兼容 COZE_API_TOKEN）、COZE_BOT_ID、COZE_USER_ID。
 */
@RestController
@RequestMapping("/ai")
public class AiAssistantController {

    @Resource
    private SafetyKnowledgeService knowledgeService;

    @Resource
    private AiProviderService aiProviderService;

    private static final String SYSTEM_PROMPT =
            "你是「筑安慧眼」房建施工现场安全隐患智能问答助手，服务对象是项目经理、专职安全员、巡检员和一线施工人员。\n" +
            "回答要求：\n" +
            "1. 只回答房屋建筑土建施工相关的安全问题，不涉及市政、桥梁、水利、隧道等场景；\n" +
            "2. 判断隐患时，按《房屋市政工程生产安全重大事故隐患判定标准（2022版）》与住建部 37 号令划分「重大 / 较大 / 一般」风险等级；\n" +
            "3. 涉及规范时必须写明标准名称与编号（如《建筑施工高处作业安全技术规范》JGJ 80-2016），不确定时明确说“需查阅现行规范原文”，严禁编造条文号；\n" +
            "4. 回答结构优先使用：结论 → 风险等级 → 整改建议 → 处理方法 → 预防措施 → 规范依据；\n" +
            "5. 覆盖 22 类房建隐患四大类：高处作业类（9 项）、个体防护类（5 项）、临时用电类（4 项）、场地消防与文明施工类（4 项）；\n" +
            "6. 语言简洁专业，适合现场管理人员直接执行，使用 Markdown 排版。";

    private RestTemplate buildRestTemplate(int connectTimeout, int readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return new RestTemplate(factory);
    }

    @GetMapping("/status")
    public Result<?> status() {
        return Result.success(aiProviderService.status());
    }

    @GetMapping("/providers")
    public Result<?> providers() {
        return Result.success(aiProviderService.list());
    }

    @PostMapping("/config")
    public Result<?> config(@RequestBody Map<String, Object> body) {
        try {
            return Result.success(aiProviderService.apply(body));
        } catch (Exception e) {
            return Result.error("-1", e.getMessage());
        }
    }

    @PostMapping("/reset")
    public Result<?> reset() {
        aiProviderService.reset();
        return Result.success(aiProviderService.status());
    }

    @PostMapping("/chat")
    public Result<?> chat(@RequestBody Map<String, Object> body) {
        List<Map<String, String>> messages = normalizeMessages(body);
        String question = lastUserContent(messages);
        if (question == null || question.trim().isEmpty()) {
            return Result.error("-1", "请输入要咨询的安全问题");
        }
        AiProviderService.Resolved resolved = aiProviderService.resolve();
        if ("coze".equals(resolved.mode)) {
            try {
                return Result.success(cozeAnswer(question, resolved));
            } catch (Exception e) {
                return Result.success(withFallback(question,
                        "扣子智能体暂时不可用（" + brief(e.getMessage()) + "）"));
            }
        }
        if ("online".equals(resolved.mode)) {
            try {
                return Result.success(onlineAnswer(messages, resolved));
            } catch (Exception e) {
                return Result.success(withFallback(question,
                        resolved.providerName + " 暂时不可用（" + brief(e.getMessage()) + "）"));
            }
        }
        return Result.success(localAnswer(question));
    }

    private Map<String, Object> withFallback(String question, String reason) {
        Map<String, Object> fallback = localAnswer(question);
        fallback.put("content", reason + "，先为你提供内置规范知识库的回答：\n\n" + fallback.get("content"));
        fallback.put("source", "local");
        fallback.put("degraded", true);
        return fallback;
    }

    /** OpenAI 兼容在线模型 */
    private Map<String, Object> onlineAnswer(List<Map<String, String>> messages, AiProviderService.Resolved resolved) {
        List<Map<String, String>> payloadMessages = new ArrayList<>();
        boolean hasSystem = messages.stream().anyMatch(m -> "system".equals(m.get("role")));
        if (!hasSystem) {
            Map<String, String> system = new HashMap<>();
            system.put("role", "system");
            system.put("content", SYSTEM_PROMPT);
            payloadMessages.add(system);
        }
        payloadMessages.addAll(messages);

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", resolved.model);
        payload.put("messages", payloadMessages);
        payload.put("temperature", 0.4);
        payload.put("max_tokens", 1200);
        payload.put("stream", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(resolved.apiKey);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        ResponseEntity<String> response = buildRestTemplate(8000, 60000)
                .postForEntity(resolved.baseUrl, request, String.class);
        String responseBody = response.getBody();
        if (responseBody == null || responseBody.isEmpty()) {
            throw new IllegalStateException("模型返回为空");
        }
        JSONObject json = JSON.parseObject(responseBody);
        JSONArray choices = json.getJSONArray("choices");
        if (choices == null || choices.isEmpty()) {
            String errorMsg = json.getString("message");
            if (errorMsg == null) {
                JSONObject error = json.getJSONObject("error");
                if (error != null) errorMsg = error.getString("message");
            }
            throw new IllegalStateException(errorMsg != null ? errorMsg : "模型未返回内容");
        }
        JSONObject message = choices.getJSONObject(0).getJSONObject("message");
        String content = message == null ? null : message.getString("content");
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalStateException("模型未返回有效内容");
        }
        Map<String, Object> data = new HashMap<>();
        data.put("content", content.trim());
        data.put("source", "online");
        data.put("model", resolved.model);
        data.put("provider", resolved.providerName);
        return data;
    }

    /** 扣子智能体：创建会话 → 轮询 → 拉取消息 */
    private Map<String, Object> cozeAnswer(String question, AiProviderService.Resolved resolved) throws Exception {
        RestTemplate restTemplate = buildRestTemplate(8000, 30000);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(resolved.apiKey);

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", question);
        userMessage.put("content_type", "text");

        Map<String, Object> payload = new HashMap<>();
        payload.put("bot_id", resolved.botId);
        payload.put("user_id", resolved.userId);
        payload.put("stream", false);
        payload.put("auto_save_history", true);
        payload.put("additional_messages", Collections.singletonList(userMessage));

        String base = resolved.baseUrl.endsWith("/")
                ? resolved.baseUrl.substring(0, resolved.baseUrl.length() - 1) : resolved.baseUrl;
        ResponseEntity<String> response = restTemplate.postForEntity(
                base + "/v3/chat", new HttpEntity<>(payload, headers), String.class);
        JSONObject json = JSON.parseObject(response.getBody());
        if (json == null || json.getIntValue("code") != 0) {
            throw new IllegalStateException(json == null ? "扣子返回为空" : json.getString("msg"));
        }
        JSONObject data = json.getJSONObject("data");
        if (data == null) {
            throw new IllegalStateException("扣子未返回会话信息");
        }
        String chatId = data.getString("id");
        String conversationId = data.getString("conversation_id");
        String status = data.getString("status");

        for (int i = 0; i < 40 && !isCozeDone(status); i++) {
            Thread.sleep(1000);
            String pollUrl = base + "/v3/chat/retrieve?chat_id=" + enc(chatId)
                    + "&conversation_id=" + enc(conversationId);
            ResponseEntity<String> poll = restTemplate.exchange(
                    pollUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            JSONObject pollJson = JSON.parseObject(poll.getBody());
            if (pollJson == null || pollJson.getIntValue("code") != 0) {
                throw new IllegalStateException(pollJson == null ? "扣子状态查询失败" : pollJson.getString("msg"));
            }
            data = pollJson.getJSONObject("data");
            status = data == null ? null : data.getString("status");
        }
        if ("failed".equals(status) || "canceled".equals(status)) {
            throw new IllegalStateException("扣子会话状态：" + status);
        }

        String listUrl = base + "/v3/chat/message/list?chat_id=" + enc(chatId)
                + "&conversation_id=" + enc(conversationId);
        ResponseEntity<String> list = restTemplate.exchange(
                listUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        JSONObject listJson = JSON.parseObject(list.getBody());
        if (listJson == null || listJson.getIntValue("code") != 0) {
            throw new IllegalStateException(listJson == null ? "扣子消息查询失败" : listJson.getString("msg"));
        }
        JSONArray items = listJson.getJSONArray("data");
        String content = null;
        if (items != null) {
            for (int i = 0; i < items.size(); i++) {
                JSONObject item = items.getJSONObject(i);
                if ("answer".equals(item.getString("type")) && "assistant".equals(item.getString("role"))) {
                    String text = item.getString("content");
                    if (text != null && !text.trim().isEmpty()) {
                        content = text.trim();
                    }
                }
            }
        }
        if (content == null) {
            throw new IllegalStateException("扣子未返回有效回答");
        }
        Map<String, Object> result = new HashMap<>();
        result.put("content", content);
        result.put("source", "coze");
        result.put("model", "Coze 智能体");
        result.put("provider", "扣子 Coze");
        return result;
    }

    private boolean isCozeDone(String status) {
        return "completed".equals(status) || "failed".equals(status)
                || "canceled".equals(status) || "requires_action".equals(status);
    }

    private String enc(String value) throws Exception {
        return java.net.URLEncoder.encode(value == null ? "" : value, "UTF-8");
    }

    private List<Map<String, String>> normalizeMessages(Map<String, Object> body) {
        List<Map<String, String>> result = new ArrayList<>();
        Object raw = body == null ? null : body.get("messages");
        if (raw instanceof List) {
            for (Object item : (List<?>) raw) {
                if (!(item instanceof Map)) continue;
                Map<?, ?> map = (Map<?, ?>) item;
                String role = map.get("role") == null ? "" : String.valueOf(map.get("role"));
                String content = map.get("content") == null ? "" : String.valueOf(map.get("content"));
                if (content.trim().isEmpty()) continue;
                if (!"user".equals(role) && !"assistant".equals(role) && !"system".equals(role)) continue;
                Map<String, String> message = new HashMap<>();
                message.put("role", role);
                message.put("content", content);
                result.add(message);
            }
            if (result.size() > 12) {
                result = new ArrayList<>(result.subList(result.size() - 12, result.size()));
            }
        }
        if (result.isEmpty() && body != null && body.get("message") != null) {
            Map<String, String> message = new HashMap<>();
            message.put("role", "user");
            message.put("content", String.valueOf(body.get("message")));
            result.add(message);
        }
        return result;
    }

    private String lastUserContent(List<Map<String, String>> messages) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            if ("user".equals(messages.get(i).get("role"))) {
                return messages.get(i).get("content");
            }
        }
        return null;
    }

    private String brief(String message) {
        if (message == null) return "未知错误";
        String text = message.replaceAll("\\s+", " ").trim();
        return text.length() > 60 ? text.substring(0, 60) + "..." : text;
    }

    private Map<String, Object> localAnswer(String question) {
        return knowledgeService.ask(question);
    }
}
