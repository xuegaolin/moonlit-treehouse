package com.treehouse.common;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.SignatureException;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT 工具类
 *
 * <p>沿用 ai-watermark-remover-quick 的 jjwt HS256 方案。
 * 密钥来自配置 wechat.jwt.secret，HS256 要求密钥长度 >= 32 字节。</p>
 */
@Slf4j
@Component
public class JwtUtil {

    @Value("${wechat.jwt.secret}")
    private String secret;

    @Value("${wechat.jwt.expiration}")
    private Long expiration;

    private Key key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        log.info("JWT 初始化完成，有效期：{} ms", expiration);
    }

    /**
     * 生成 Token（subject = openid）
     *
     * @param openid 微信用户 openid
     * @return JWT 字符串
     */
    public String generateToken(String openid) {
        Date now = new Date();
        Date expireDate = new Date(now.getTime() + expiration);

        Map<String, Object> claims = new HashMap<>();
        claims.put("openid", openid);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(openid)
                .setIssuedAt(now)
                .setExpiration(expireDate)
                .signWith(key)
                .compact();
    }

    /**
     * 从 Token 解析 openid；解析失败返回 null
     */
    public String getOpenidFromToken(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            return claims.get("openid", String.class);
        } catch (Exception e) {
            log.warn("解析 Token 失败：{}", e.getMessage());
            return null;
        }
    }

    /**
     * 校验 Token 是否有效（签名正确且未过期）
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (SignatureException | MalformedJwtException | UnsupportedJwtException | IllegalArgumentException e) {
            log.warn("Token 无效：{}", e.getMessage());
        } catch (ExpiredJwtException e) {
            log.warn("Token 已过期：{}", e.getMessage());
        }
        return false;
    }
}
