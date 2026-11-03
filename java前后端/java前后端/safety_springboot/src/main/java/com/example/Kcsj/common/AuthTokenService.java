package com.example.Kcsj.common;

import com.example.Kcsj.entity.User;
import org.springframework.stereotype.Component;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 轻量登录态：登录成功发一个随机 token，前端存 Cookie；
 * 后端按 token 还原当前用户，用于工单列表/操作鉴权。
 *
 * 说明：当前项目没有引入 Spring Security，这里先用内存 token，
 * 后端重启后需要重新登录；后续可替换为 JWT/Redis 会话。
 */
@Component
public class AuthTokenService {

    private static final long TTL_MILLIS = 24L * 60 * 60 * 1000;

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public String issue(User user) {
        String token = UUID.randomUUID().toString().replace("-", "");
        sessions.put(token, new Session(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getRole(),
                System.currentTimeMillis() + TTL_MILLIS
        ));
        return token;
    }

    public AuthUser resolve(HttpServletRequest request) {
        if (request == null) return null;
        String token = headerToken(request);
        if (token == null || token.isEmpty()) {
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("token".equals(cookie.getName())) {
                        token = cookie.getValue();
                        break;
                    }
                }
            }
        }
        if (token == null || token.isEmpty()) return null;
        Session session = sessions.get(token);
        if (session == null) return null;
        if (session.expiresAt < System.currentTimeMillis()) {
            sessions.remove(token);
            return null;
        }
        return new AuthUser(session.id, session.username, session.name, session.role);
    }

    public void revoke(HttpServletRequest request) {
        String token = headerToken(request);
        if (token == null || token.isEmpty()) {
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("token".equals(cookie.getName())) {
                        token = cookie.getValue();
                        break;
                    }
                }
            }
        }
        if (token != null) sessions.remove(token);
    }

    private String headerToken(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7).trim();
        }
        return request.getHeader("X-Auth-Token");
    }

    private static class Session {
        final Integer id;
        final String username;
        final String name;
        final String role;
        final long expiresAt;

        Session(Integer id, String username, String name, String role, long expiresAt) {
            this.id = id;
            this.username = username;
            this.name = name;
            this.role = role;
            this.expiresAt = expiresAt;
        }
    }

    public static class AuthUser {
        private final Integer id;
        private final String username;
        private final String name;
        private final String role;

        public AuthUser(Integer id, String username, String name, String role) {
            this.id = id;
            this.username = username;
            this.name = name;
            this.role = role;
        }

        public Integer getId() { return id; }
        public String getUsername() { return username; }
        public String getName() { return name; }
        public String getRole() { return role; }
    }
}
