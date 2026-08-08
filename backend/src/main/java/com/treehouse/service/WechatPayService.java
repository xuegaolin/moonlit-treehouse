package com.treehouse.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.crypto.SecureUtil;
import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.entity.MemberOrder;
import com.treehouse.entity.User;
import com.treehouse.repository.MemberOrderRepository;
import com.treehouse.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 微信支付服务（占位实现）
 *
 * <p>MVP 阶段：使用 mock 模式，不真正调微信下单接口，仅生成订单号并返回 fake wxPayParams。
 * 生产环境需：
 * <ol>
 *   <li>pom.xml 打开 wechatpay-java 依赖</li>
 *   <li>application.yml 配置 wechatpay.mchid/private-key/cert-serial-no/api-v3-key/notify-url</li>
 *   <li>切换 {@link #mockMode} = false，实现真实 JSAPI 下单</li>
 *   <li>补充 /order/notify 回调控制器验签后调用 {@link #handlePaymentSuccess}</li>
 * </ol></p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WechatPayService {

    private final MemberOrderRepository memberOrderRepository;
    private final UserRepository userRepository;

    @Value("${wechatpay.mock-mode:true}")
    private boolean mockMode;

    @Value("${wechatpay.mchid:}")
    private String mchid;

    @Value("${wechatpay.notify-url:}")
    private String notifyUrl;

    /**
     * 创建会员订单并发起下单
     *
     * @param userId    用户 ID
     * @param openid    微信 openid
     * @param planCode  套餐 MONTH/YEAR/LIFE
     * @param price     价格（元）
     * @param days      会员天数
     * @return { orderId, wxPayParams }  wxPayParams 供小程序 wx.requestPayment 使用
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createOrder(Long userId, String openid,
                                           String planCode, BigDecimal price, int days) {
        // 1. 创建预支付订单（此时未支付成功，不写 t_membership 生效期）
        String outTradeNo = "MT" + System.currentTimeMillis() + IdUtil.fastSimpleUUID().substring(0, 8);

        MemberOrder order = new MemberOrder();
        order.setUserId(userId);
        order.setLevel(planCode);
        order.setPrice(price);
        // 占位：先写创建时间，实际生效期由支付回调触发
        order.setStartAt(LocalDateTime.now());
        order.setExpireAt(LocalDateTime.now().plusDays(days));
        memberOrderRepository.save(order);

        Map<String, Object> result = new HashMap<>();
        result.put("orderId", outTradeNo);
        result.put("amount", price);

        if (mockMode) {
            log.warn("[wechatpay-mock] 未接入真实微信支付，返回 fake wxPayParams：orderId={}", outTradeNo);
            result.put("wxPayParams", null);
            result.put("mockMode", true);
            result.put("tip", "支付接入中，敬请期待");
        } else {
            // TODO(生产): 调用 wechatpay-java 的 JSAPI 下单接口
            //  1. 组装 PrepayRequest：appid/mchid/description/out_trade_no/notify_url/amount/payer.openid
            //  2. 用 JsapiServiceExtension.prepayWithRequestPayment(request) 获取 wxPayParams
            //  3. wxPayParams 结构：{ timeStamp, nonceStr, package: 'prepay_id=xxx', signType: 'RSA', paySign }
            //  4. 前端 wx.requestPayment(wxPayParams) 拉起支付
            //  5. 支付成功后微信回调 notifyUrl → OrderNotifyController → handlePaymentSuccess
            log.info("[wechatpay-real] 未实现真实下单，请补充 wechatpay-java 调用：orderId={}", outTradeNo);
            result.put("wxPayParams", buildFakeParams(outTradeNo));
        }

        return result;
    }

    /**
     * 支付成功回调（微信回调 → 验签成功后调用此方法）
     *
     * @param outTradeNo   商户订单号
     * @param openid       支付用户 openid
     * @param transactionId 微信支付单号（用于对账日志）
     */
    @Transactional(rollbackFor = Exception.class)
    public void handlePaymentSuccess(String outTradeNo, String openid, String transactionId) {
        log.info("支付成功回调：outTradeNo={}, openid={}, wxTxId={}", outTradeNo, openid, transactionId);

        User user = userRepository.findByOpenid(openid)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND.getCode(), "用户不存在"));

        // 顺延会员到期时间：老到期时间未过 → 从老到期时间开始加；已过 → 从今天开始加
        // MVP 简化：按订单里预计的 expireAt 直接生效（真实回调需按 planCode 重新算天数）
        // TODO：改为 findByOutTradeNo 查询订单，从 order.level 取天数计算
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime oldExpire = user.getMemberExpireAt();
        LocalDateTime newExpire = (oldExpire != null && oldExpire.isAfter(now))
                ? oldExpire.plusDays(30)  // 占位：需按 order 里的 level 取真实天数
                : now.plusDays(30);
        user.setMemberExpireAt(newExpire);
        userRepository.save(user);

        log.info("会员延长成功：userId={}, newExpire={}", user.getId(), newExpire);
    }

    /** Mock 模式下的假 wxPayParams（前端识别 mockMode 后跳过 wx.requestPayment） */
    private Map<String, Object> buildFakeParams(String outTradeNo) {
        Map<String, Object> p = new HashMap<>();
        p.put("timeStamp", String.valueOf(System.currentTimeMillis() / 1000));
        p.put("nonceStr", IdUtil.fastSimpleUUID());
        p.put("package", "prepay_id=mock_" + outTradeNo);
        p.put("signType", "RSA");
        p.put("paySign", SecureUtil.md5(outTradeNo).toUpperCase());
        return p;
    }
}
