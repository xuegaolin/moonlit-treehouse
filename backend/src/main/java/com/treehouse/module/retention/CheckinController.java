package com.treehouse.module.retention;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * 留存钩子接口：签到 / 签到状态 / 勋章墙。
 *
 * <p>这三个接口是产品的"明天再来"理由，原 PRD 规划但从未实现。</p>
 */
@Slf4j
@RestController
@RequestMapping("/checkin")
@RequiredArgsConstructor
public class CheckinController extends BaseController {

    private final CheckinService checkinService;

    /** 每日签到（幂等：重复调用返回业务错误"今天已签到"） */
    @PostMapping("/do")
    public R<Map<String, Object>> doCheckin(HttpServletRequest request) {
        Long userId = currentUserId(request);
        return R.ok(checkinService.checkin(userId));
    }

    /** 签到状态（首页展示用，无副作用） */
    @GetMapping("/status")
    public R<Map<String, Object>> status(HttpServletRequest request) {
        Long userId = currentUserId(request);
        return R.ok(checkinService.status(userId));
    }

    /** 勋章墙（含未解锁项与进度） */
    @GetMapping("/medals")
    public R<Map<String, Object>> medals(HttpServletRequest request) {
        Long userId = currentUserId(request);
        return R.ok(checkinService.medals(userId));
    }
}
