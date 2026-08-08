package com.treehouse.module.letter;

import cn.hutool.json.JSONObject;
import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.letter.dto.CreateLetterRequest;
import com.treehouse.module.letter.dto.LetterDetailVO;
import com.treehouse.module.letter.dto.LetterVO;
import com.treehouse.module.letter.dto.SubscribeGrantRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * 深夜信箱控制器（模块 A）
 *
 * <p>对齐 API 规范 docs/02-architecture/02-api-spec.md 第二节：</p>
 * <ul>
 *   <li>POST /letter/create 写信</li>
 *   <li>GET  /letter/mine   我的信箱（status / page / size）</li>
 *   <li>GET  /letter/detail 详情（letterId）</li>
 *   <li>POST /letter/deliver-now 手动立即投递（调试）</li>
 *   <li>POST /letter/cancel 撤回未投信件</li>
 *   <li>POST /letter/scan-due 扫描到期待投（管理员 / 内部定时）</li>
 *   <li><b>POST /letter/subscribe-grant  前端拿到 wx.requestSubscribeMessage 授权后回调</b></li>
 *   <li><b>GET  /letter/subscribe-status 查某封信的订阅状态（PENDING/PUSHED/EXPIRED/无 log）</b></li>
 *   <li><b>POST /letter/admin/set-template-id  运营填真 template_id（仅 dev profile）</b></li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/letter")
@RequiredArgsConstructor
public class LetterController extends BaseController {

    private final LetterService letterService;

    @PostMapping("/ping")
    public R<String> ping() {
        return R.ok("letter module ready (v1.1)");
    }

    @PostMapping("/create")
    public R<LetterVO> create(HttpServletRequest request,
                              @RequestBody @Validated CreateLetterRequest req) {
        return R.ok(letterService.create(currentUserId(request), req));
    }

    @GetMapping("/mine")
    public R<Map<String, Object>> mine(HttpServletRequest request,
                                       @RequestParam(required = false) String status,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size) {
        return R.ok(letterService.mine(currentUserId(request), status, page, size));
    }

    @GetMapping("/detail")
    public R<LetterDetailVO> detail(HttpServletRequest request,
                                    @RequestParam String letterId) {
        return R.ok(letterService.detail(currentUserId(request), letterId));
    }

    @PostMapping("/deliver-now")
    public R<LetterDetailVO> deliverNow(HttpServletRequest request,
                                        @RequestParam String letterId) {
        return R.ok(letterService.deliverNow(currentUserId(request), letterId));
    }

    @PostMapping("/cancel")
    public R<Void> cancel(HttpServletRequest request,
                          @RequestParam String letterId) {
        letterService.cancel(currentUserId(request), letterId);
        return R.ok();
    }

    /**
     * 内部扫描接口（运营 / 定时任务可调，MVP 不加鉴权，依赖网络层 IP 白名单）
     */
    @PostMapping("/scan-due")
    public R<Map<String, Object>> scanDue() {
        int count = letterService.deliverDueLetters();
        return R.ok(java.util.Collections.singletonMap("delivered", count));
    }

    /**
     * 前端拿到 wx.requestSubscribeMessage 授权后回调，把 push_token 入库。
     *
     * <p>失败回滚：letterId 不属于当前用户 / log 已存在 → 静默 ok，不报错。
     * 业务层只关心 push_token 是否入到 log，dev / 无 template_id 场景下也照样能跑。</p>
     */
    @PostMapping("/subscribe-grant")
    public R<Map<String, Object>> subscribeGrant(HttpServletRequest request,
                                                 @RequestBody @Validated SubscribeGrantRequest req) {
        Long userId = currentUserId(request);
        String status = letterService.grantSubscribe(userId, req);
        return R.ok(java.util.Collections.singletonMap("status", status));
    }

    /**
     * 查某封信的订阅推送状态。
     *
     * <p>返回值：</p>
     * <ul>
     *   <li>{ subscribed: false } - 没 log（未授权 / 写完时拒了）</li>
     *   <li>{ subscribed: true, status: "PENDING" } - 已授权待投递</li>
     *   <li>{ subscribed: true, status: "PUSHED" } - 已推成功</li>
     *   <li>{ subscribed: true, status: "EXPIRED" } - 30 天过期</li>
     *   <li>{ subscribed: true, status: "FAILED" } - 推失败</li>
     * </ul>
     */
    @GetMapping("/subscribe-status")
    public R<Map<String, Object>> subscribeStatus(HttpServletRequest request,
                                                  @RequestParam String letterId) {
        Long userId = currentUserId(request);
        Map<String, Object> data = letterService.subscribeStatus(userId, letterId);
        return R.ok(data);
    }

    /**
     * 管理员 / 运营填入真 template_id 后回灌（仅 dev profile 可达）。
     *
     * <p>真实 template_id 在 mp.weixin.qq.com 申请，本地开发时若要模拟推送流程可填一个
     * 假 id；线上不要走这个接口，template_id 应通过环境变量 WECHAT_TEMPLATE_ID_LETTER
     * 启动时注入到 application.yml。</p>
     */
    @PostMapping("/admin/set-template-id")
    public R<Void> setTemplateId(@RequestBody @Validated Map<String, String> body) {
        // 鉴权：依赖 profile 拦截，prod 下不暴露
        String id = body.get("templateId");
        if (id == null) {
            return R.error(400, "templateId 必填");
        }
        letterService.setTemplateId(id);
        log.info("[dev] template_id 已动态设置：{}", id);
        return R.ok();
    }
}
