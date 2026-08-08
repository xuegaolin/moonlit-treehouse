package com.treehouse.module.tarot;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.tarot.dto.TarotHistoryItemVO;
import com.treehouse.module.tarot.dto.TarotReadingVO;
import com.treehouse.module.tarot.dto.TarotTodayCheckVO;
import com.treehouse.module.tarot.dto.ThreeCardsRequest;
import com.treehouse.module.tarot.dto.UnlockRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

/**
 * 塔罗盲盒控制器（模块 C）
 *
 * <p>对齐 API 规范 docs/02-architecture/02-api-spec.md 第四节：</p>
 * <ul>
 *   <li>POST /tarot/daily        每日一抽（限次）</li>
 *   <li>POST /tarot/three-cards  三牌阵（带问题）</li>
 *   <li>POST /tarot/unlock       解锁完整解读（9.9 元）</li>
 *   <li>GET  /tarot/today-check  今日是否已抽（不抽，只查）</li>
 *   <li>GET  /tarot/history      历史记录（分页）</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/tarot")
@RequiredArgsConstructor
public class TarotController extends BaseController {

    private final TarotService tarotService;

    @PostMapping("/ping")
    public R<String> ping() {
        return R.ok("tarot module ready (v1.3)");
    }

    @PostMapping("/daily")
    public R<TarotReadingVO> daily(HttpServletRequest request) {
        return R.ok(tarotService.daily(currentUserId(request)));
    }

    @PostMapping("/three-cards")
    public R<TarotReadingVO> threeCards(HttpServletRequest request,
                                        @RequestBody(required = false) ThreeCardsRequest req) {
        return R.ok(tarotService.threeCards(currentUserId(request), req));
    }

    @PostMapping("/unlock")
    public R<TarotReadingVO> unlock(HttpServletRequest request,
                                    @RequestBody UnlockRequest req) {
        return R.ok(tarotService.unlock(currentUserId(request), req));
    }

    /**
     * 今日是否已抽（只读，不抽）
     */
    @GetMapping("/today-check")
    public R<TarotTodayCheckVO> todayCheck(HttpServletRequest request) {
        return R.ok(tarotService.todayCheck(currentUserId(request)));
    }

    /**
     * 历史记录（按时间倒序，分页）
     *
     * @param page 从 0 开始
     * @param size 每页条数（1-50，默认 20）
     */
    @GetMapping("/history")
    public R<List<TarotHistoryItemVO>> history(HttpServletRequest request,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size) {
        return R.ok(tarotService.history(currentUserId(request), page, size));
    }
}
