package com.treehouse.common;

import com.treehouse.entity.User;
import com.treehouse.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;

import javax.servlet.http.HttpServletRequest;

/**
 * Controller 基类
 *
 * <p>提供"从请求属性取 openid → 查用户"的公共能力。
 * openid 由 {@code AuthInterceptor} 校验 JWT 后放入 request attribute。</p>
 */
public abstract class BaseController {

    @Autowired
    protected UserService userService;

    /**
     * 获取当前登录用户 ID
     *
     * @param request 当前请求（拦截器已写入 openid 属性）
     * @return 用户主键
     */
    protected Long currentUserId(HttpServletRequest request) {
        return currentUser(request).getId();
    }

    /**
     * 获取当前登录用户 ID，未登录返回 null（不抛异常）。
     *
     * <p>用于「登录可选」的接口：如漂流瓶信息流，登录后需要额外返回
     * isMine / warmed 等个人化字段，未登录时也应能正常浏览。</p>
     */
    protected Long currentUserIdOrNull(HttpServletRequest request) {
        Object openid = request.getAttribute("openid");
        if (openid == null) {
            return null;
        }
        try {
            User u = userService.getByOpenid(String.valueOf(openid));
            return u == null ? null : u.getId();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 获取当前登录用户实体
     */
    protected User currentUser(HttpServletRequest request) {
        Object openid = request.getAttribute("openid");
        if (openid == null) {
            throw new BizException(ResultCode.UNAUTHORIZED);
        }
        return userService.getByOpenid(String.valueOf(openid));
    }
}
