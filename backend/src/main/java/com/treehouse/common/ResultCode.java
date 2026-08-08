package com.treehouse.common;

import lombok.Getter;

/**
 * 统一业务码
 *
 * <p>与 docs/02-architecture/02-api-spec.md 错误码约定对齐：
 * 200 成功 / 40101 未登录 / 40201 违规 / 40301 无权限 / 40401 不存在 / 42901 频繁 / 50001 内部错 / 50002 AI失败</p>
 */
@Getter
public enum ResultCode {

    SUCCESS(200, "ok"),
    BAD_REQUEST(40000, "参数错误"),
    UNAUTHORIZED(40101, "未登录或登录已过期"),
    CONTENT_VIOLATION(40201, "内容未通过审核"),
    FORBIDDEN(40301, "无权限"),
    NOT_FOUND(40401, "资源不存在"),
    TOO_FREQUENT(42901, "操作太频繁，明天再来"),
    INTERNAL_ERROR(50001, "服务器开了个小差"),
    AI_ERROR(50002, "AI 正在走神，请稍后再试");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
