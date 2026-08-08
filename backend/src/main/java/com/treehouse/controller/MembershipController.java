package com.treehouse.controller;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.dto.SubscribeRequest;
import com.treehouse.service.MembershipService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 会员控制器
 *
 * <p>价格档对齐 PRD：月卡 19 元 / 年卡 128 元 / 终身 388 元。
 * 支付链路 TODO(v2.0)。</p>
 */
@RestController
@RequestMapping("/membership")
@RequiredArgsConstructor
public class MembershipController extends BaseController {

    private final MembershipService membershipService;

    /**
     * 会员套餐列表
     *
     * <p>GET /api/v1/membership/plans → { plans }</p>
     */
    @GetMapping("/plans")
    public R<Map<String, Object>> plans() {
        List<Map<String, Object>> plans = membershipService.plans();
        Map<String, Object> data = new HashMap<>();
        data.put("plans", plans);
        return R.ok(data);
    }

    /**
     * 开通会员（占位：返回待支付订单，微信支付参数 TODO）
     *
     * <p>POST /api/v1/membership/subscribe { planCode } → { orderId, wxPayParams }</p>
     */
    @PostMapping("/subscribe")
    public R<Map<String, Object>> subscribe(HttpServletRequest request,
                                            @RequestBody @Validated SubscribeRequest req) {
        return R.ok(membershipService.subscribe(currentUserId(request), req.getPlanCode()));
    }
}
