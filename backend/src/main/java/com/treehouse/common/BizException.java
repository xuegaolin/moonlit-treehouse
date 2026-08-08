package com.treehouse.common;

import lombok.Getter;

/**
 * 业务异常
 *
 * <p>Service 层抛出，由 {@link GlobalExceptionHandler} 统一转成 {@link R} 返回。</p>
 */
@Getter
public class BizException extends RuntimeException {

    /** 业务码，见 ResultCode */
    private final int code;

    public BizException(ResultCode rc) {
        super(rc.getMessage());
        this.code = rc.getCode();
    }

    public BizException(ResultCode rc, String message) {
        super(message);
        this.code = rc.getCode();
    }

    public BizException(int code, String message) {
        super(message);
        this.code = code;
    }
}
