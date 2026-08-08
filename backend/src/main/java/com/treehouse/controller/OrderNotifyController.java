package com.treehouse.controller;

import com.treehouse.common.R;
import com.treehouse.service.WechatPayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * 微信支付回调控制器
 *
 * <p>POST /api/v1/order/notify</p>
 *
 * <p>【重要】路径已加入 AuthInterceptor 白名单，允许无 token 访问。
 * 生产环境必须做以下校验：
 * <ol>
 *   <li>验证 Wechatpay-Signature 头（V3 签名校验）</li>
 *   <li>用 API v3 密钥 AES-GCM 解密 resource.ciphertext</li>
 *   <li>幂等校验（同一 out_trade_no 只处理一次）</li>
 *   <li>金额校验（回调金额与订单金额一致）</li>
 * </ol></p>
 *
 * <p>MVP 阶段：仅接收请求 + 打印日志，不做真实业务处理。</p>
 */
@Slf4j
@RestController
@RequestMapping("/order")
@RequiredArgsConstructor
public class OrderNotifyController {

    private final WechatPayService wechatPayService;

    /**
     * 微信支付结果通知
     *
     * <p>成功需返回 HTTP 200 + { code: "SUCCESS", message: "OK" }
     * 失败需返回 HTTP 500，微信会重试。</p>
     */
    @PostMapping("/notify")
    public Map<String, String> notify(HttpServletRequest request, @RequestBody(required = false) String rawBody) {
        log.info("收到微信支付回调：headers={}, body={}",
                request.getHeader("Wechatpay-Serial"),
                rawBody == null ? "" : (rawBody.length() > 200 ? rawBody.substring(0, 200) + "..." : rawBody));

        // TODO(生产实现):
        // 1. String signature = request.getHeader("Wechatpay-Signature");
        //    String timestamp = request.getHeader("Wechatpay-Timestamp");
        //    String nonce = request.getHeader("Wechatpay-Nonce");
        //    String serial = request.getHeader("Wechatpay-Serial");
        // 2. NotificationConfig config = new RSAAutoCertificateConfig.Builder()
        //          .merchantId(mchid).privateKey(...).apiV3Key(apiV3Key).build();
        //    NotificationParser parser = new NotificationParser(config);
        //    Transaction tx = parser.parse(new RequestParam.Builder()
        //          .serialNumber(serial).nonce(nonce).timestamp(timestamp)
        //          .signature(signature).body(rawBody).build(), Transaction.class);
        // 3. if ("SUCCESS".equals(tx.getTradeState().name())) {
        //        wechatPayService.handlePaymentSuccess(tx.getOutTradeNo(), tx.getPayer().getOpenid(), tx.getTransactionId());
        //    }

        // MVP: 直接回 SUCCESS，避免联调时微信一直重试
        Map<String, String> resp = new HashMap<>();
        resp.put("code", "SUCCESS");
        resp.put("message", "OK");
        return resp;
    }
}
