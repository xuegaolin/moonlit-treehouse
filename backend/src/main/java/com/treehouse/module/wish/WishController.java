package com.treehouse.module.wish;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.wish.dto.CloseWishRequest;
import com.treehouse.module.wish.dto.CreateWishRequest;
import com.treehouse.module.wish.dto.MokugyoTapRequest;
import com.treehouse.module.wish.dto.WishVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;

/**
 * 许愿池控制器（模块 D）
 *
 * <p>对齐 API 规范 docs/02-architecture/02-api-spec.md 第五节：</p>
 * <ul>
 *   <li>POST /wish/mokugyo/tap  木鱼敲击（批量）</li>
 *   <li>POST /wish/create        许愿</li>
 *   <li>GET  /wish/mine          我的愿望</li>
 *   <li>POST /wish/close         结愿（带月光祝福）</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/wish")
@RequiredArgsConstructor
public class WishController extends BaseController {

    private final WishService wishService;

    @PostMapping("/ping")
    public R<String> ping() {
        return R.ok("wish module ready (v1.3)");
    }

    @PostMapping("/mokugyo/tap")
    public R<Map<String, Object>> tap(HttpServletRequest request,
                                     @RequestBody @Validated MokugyoTapRequest req) {
        return R.ok(wishService.mokugyoTap(currentUserId(request), req));
    }

    @PostMapping("/create")
    public R<WishVO> create(HttpServletRequest request,
                            @RequestBody @Validated CreateWishRequest req) {
        return R.ok(wishService.create(currentUserId(request), req));
    }

    @GetMapping("/mine")
    public R<List<WishVO>> mine(HttpServletRequest request) {
        return R.ok(wishService.mine(currentUserId(request)));
    }

    @PostMapping("/close")
    public R<Map<String, Object>> close(HttpServletRequest request,
                                       @RequestBody @Validated CloseWishRequest req) {
        return R.ok(wishService.close(currentUserId(request), req));
    }
}
