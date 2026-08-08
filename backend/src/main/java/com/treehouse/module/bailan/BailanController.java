package com.treehouse.module.bailan;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.bailan.dto.GenerateLicenseRequest;
import com.treehouse.module.bailan.dto.LicenseVO;
import lombok.RequiredArgsConstructor;
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
 * 摆烂许可证控制器（模块 B，MVP 核心）
 *
 * <p>每日一键领取"今日摆烂许可证"，证书图由前端 Canvas 合成。</p>
 */
@RestController
@RequestMapping("/bailan")
@RequiredArgsConstructor
public class BailanController extends BaseController {

    private final BailanService bailanService;

    /**
     * 领取今日摆烂许可证
     *
     * <p>POST /api/v1/bailan/generate</p>
     *
     * @return { licenseId, licenseNo, imageUrl, reasonText, coinReward }
     */
    @PostMapping("/generate")
    public R<LicenseVO> generate(HttpServletRequest request,
                                 @RequestBody @Validated GenerateLicenseRequest req) {
        return R.ok(bailanService.generate(currentUserId(request), req));
    }

    /**
     * 我的许可证列表（含连续打卡天数、勋章、今日是否已领）
     *
     * <p>GET /api/v1/bailan/mine?page=&size=</p>
     */
    @GetMapping("/mine")
    public R<Map<String, Object>> mine(HttpServletRequest request,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "10") int size) {
        return R.ok(bailanService.mine(currentUserId(request), page, size));
    }

    /**
     * 摆烂日历
     *
     * <p>GET /api/v1/bailan/calendar?month=yyyyMM</p>
     */
    @GetMapping("/calendar")
    public R<Map<String, Object>> calendar(HttpServletRequest request,
                                           @RequestParam String month) {
        return R.ok(bailanService.calendar(currentUserId(request), month));
    }
}
