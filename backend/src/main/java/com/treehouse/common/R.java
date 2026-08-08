package com.treehouse.common;

import cn.hutool.core.util.IdUtil;
import lombok.Data;

import java.io.Serializable;

/**
 * 统一返回体
 *
 * <p>结构对齐 API 规范：{ code, message, data, traceId, timestamp }</p>
 *
 * @param <T> 业务数据类型
 */
@Data
public class R<T> implements Serializable {

    /** 业务码，200 表示成功，其余见 ResultCode */
    private int code;

    /** 提示信息 */
    private String message;

    /** 业务数据 */
    private T data;

    /** 链路追踪 ID（前端可透传 X-Trace-Id） */
    private String traceId;

    /** 服务端时间戳 */
    private long timestamp;

    private R() {
        this.traceId = IdUtil.fastSimpleUUID();
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.setCode(ResultCode.SUCCESS.getCode());
        r.setMessage(ResultCode.SUCCESS.getMessage());
        r.setData(data);
        return r;
    }

    public static R<Void> ok() {
        return ok(null);
    }

    public static R<Void> error(ResultCode rc) {
        return error(rc.getCode(), rc.getMessage());
    }

    public static R<Void> error(int code, String message) {
        R<Void> r = new R<>();
        r.setCode(code);
        r.setMessage(message);
        return r;
    }
}
