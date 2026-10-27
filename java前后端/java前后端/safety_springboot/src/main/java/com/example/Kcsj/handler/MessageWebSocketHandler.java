package com.example.Kcsj.handler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.alibaba.fastjson.JSONObject;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.mapper.UserMapper;

@Component
public class MessageWebSocketHandler extends TextWebSocketHandler {

    public static final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Autowired
    private UserMapper userMapper;

    private boolean validateUser(String userId) {
        if (userId == null || userId.isEmpty()) {
            return false;
        }
        try {
            User user = userMapper.selectByUsername(userId);
            return user != null;
        } catch (Exception e) {
            System.err.println("WebSocket注册验证用户失败: userId=" + userId + ", error=" + e.getMessage());
            return false;
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("WebSocket连接建立: sessionId=" + session.getId() + ", remoteAddress=" + session.getRemoteAddress());
        super.afterConnectionEstablished(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        System.out.println("收到WebSocket消息: " + payload);

        // 格式1: 纯文本 "register:userId"
        if (payload != null && payload.startsWith("register:")) {
            String userId = payload.substring(9);
            if (!validateUser(userId)) {
                System.out.println("WebSocket注册拒绝(用户不存在): userId=" + userId);
                session.close(CloseStatus.NOT_ACCEPTABLE);
                return;
            }
            sessions.put(userId, session);
            session.getAttributes().put("userId", userId);
            System.out.println("用户注册WebSocket(纯文本): userId=" + userId);
        }
        // 格式2: JSON {"type":"register", "userId":"xxx"}
        else if (payload != null && payload.startsWith("{")) {
            try {
                JSONObject json = JSONObject.parseObject(payload);
                if ("register".equals(json.getString("type"))) {
                    String userId = json.getString("userId");
                    if (userId == null || userId.isEmpty()) {
                        session.close(CloseStatus.NOT_ACCEPTABLE);
                        return;
                    }
                    if (!validateUser(userId)) {
                        System.out.println("WebSocket注册拒绝(用户不存在): userId=" + userId);
                        session.close(CloseStatus.NOT_ACCEPTABLE);
                        return;
                    }
                    sessions.put(userId, session);
                    session.getAttributes().put("userId", userId);
                    System.out.println("用户注册WebSocket(JSON): userId=" + userId);
                }
            } catch (Exception e) {
                System.err.println("解析JSON消息失败: " + e.getMessage());
            }
        }
        super.handleTextMessage(session, message);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = (String) session.getAttributes().get("userId");
        if (userId != null) {
            sessions.remove(userId);
            System.out.println("WebSocket连接关闭: userId=" + userId);
        }
        sessions.entrySet().removeIf(entry -> entry.getValue().getId().equals(session.getId()));
        System.out.println("当前在线WebSocket用户数: " + sessions.size());
        super.afterConnectionClosed(session, status);
    }

    public static void sendMessageToUser(String userId, String message) {
        WebSocketSession session = sessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(message));
                System.out.println("推送消息成功: userId=" + userId);
            } catch (IOException e) {
                System.err.println("推送消息失败: userId=" + userId + ", error=" + e.getMessage());
            }
        } else {
            System.out.println("用户未连接WebSocket: userId=" + userId + " (在线用户: " + sessions.keySet() + ")");
        }
    }

    public static void broadcastMessage(String message) {
        for (Map.Entry<String, WebSocketSession> entry : sessions.entrySet()) {
            WebSocketSession session = entry.getValue();
            if (session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(message));
                } catch (IOException e) {
                    System.err.println("广播消息失败: userId=" + entry.getKey() + ", error=" + e.getMessage());
                }
            }
        }
    }

    public static void sendMessageToMultipleUsers(java.util.List<String> userIds, String message) {
        System.out.println("准备向 " + userIds.size() + " 个用户推送消息, 在线用户: " + sessions.keySet());
        for (String userId : userIds) {
            sendMessageToUser(userId, message);
        }
    }
}