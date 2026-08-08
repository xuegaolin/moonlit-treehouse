package com.treehouse.module.privacy;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.privacy.dto.PrivacyUpdateRequest;
import com.treehouse.module.privacy.dto.PrivacyVO;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;

/**
 * 隐私与社交开关（v1.5）
 *
 * <ul>
 *   <li>GET  /user/privacy  获取当前设置</li>
 *   <li>PUT  /user/privacy  更新设置（含校验会员/实名）</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/user/privacy")
@RequiredArgsConstructor
public class PrivacyController extends BaseController {

    private final PrivacyService privacyService;

    @GetMapping
    public R<PrivacyVO> get(HttpServletRequest request) {
        return R.ok(privacyService.getPrivacy(currentUserId(request)));
    }

    @PutMapping
    public R<PrivacyVO> update(HttpServletRequest request,
                                @RequestBody @Validated PrivacyUpdateRequest req) {
        return R.ok(privacyService.updatePrivacy(currentUserId(request), req));
    }

    @Data
    public static class RealNameRequest {
        private String code;
        private String phone;
    }

    /**
     * 实名认证（测试接口）
     *
     * <p>POST /api/v1/user/privacy/real-name → PrivacyVO</p>
     */
    @PostMapping("/real-name")
    public R<PrivacyVO> verifyRealName(HttpServletRequest request,
                                        @RequestBody(required = false) RealNameRequest req,
                                        @RequestParam(required = false) String code,
                                        @RequestParam(required = false) String phone) {
        Long userId = currentUserId(request);
        
        // 同时支持 body 和 query 参数
        String finalCode = (req != null && req.code != null) ? req.code : code;
        String finalPhone = (req != null && req.phone != null) ? req.phone : phone;
        
        log.info("[实名] 用户ID: {}, code: {}, phone: {}", userId, finalCode, finalPhone != null ? "***" : null);
        
        // 测试模式：直接设置实名状态，不需要真实的微信 code
        privacyService.setRealNameVerified(userId, true);
        
        log.info("[实名] 认证成功，用户ID: {}", userId);
        return R.ok(privacyService.getPrivacy(userId));
    }

    /**
     * 取消实名认证（测试用）
     */
    @PostMapping("/real-name/cancel")
    public R<PrivacyVO> cancelRealName(HttpServletRequest request) {
        Long userId = currentUserId(request);
        log.info("[实名] 取消认证，用户ID: {}", userId);
        
        privacyService.setRealNameVerified(userId, false);
        
        return R.ok(privacyService.getPrivacy(userId));
    }
}
