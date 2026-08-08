package com.treehouse.module.bottle;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.bottle.dto.BottleVO;
import com.treehouse.module.bottle.dto.PublishBottleRequest;
import com.treehouse.module.bottle.dto.WarmRequest;
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
 * 漂流墙控制器（模块 E）
 *
 * <p>对齐 API 规范 docs/02-architecture/02-api-spec.md 第六节：</p>
 * <ul>
 *   <li>POST /bottle/publish  发布</li>
 *   <li>GET  /bottle/feed     信息流</li>
 *   <li>POST /bottle/warm     温暖（送礼物）</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/bottle")
@RequiredArgsConstructor
public class BottleController extends BaseController {

    private final BottleService bottleService;

    @PostMapping("/ping")
    public R<String> ping() {
        return R.ok("bottle module ready (v1.4)");
    }

    @PostMapping("/publish")
    public R<BottleVO> publish(HttpServletRequest request,
                               @RequestBody @Validated PublishBottleRequest req) {
        return R.ok(bottleService.publish(currentUserId(request), req));
    }

    @GetMapping("/feed")
    public R<Map<String, Object>> feed(HttpServletRequest request,
                                       @RequestParam(required = false) String tag,
                                       @RequestParam(defaultValue = "latest") String sort,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size) {
        return R.ok(bottleService.feed(currentUserIdOrNull(request), tag, sort, page, size));
    }

    @PostMapping("/warm")
    public R<Map<String, Object>> warm(HttpServletRequest request,
                                       @RequestBody @Validated WarmRequest req) {
        return R.ok(bottleService.warm(currentUserId(request), req));
    }
}
