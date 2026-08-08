package com.treehouse.module.feature;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.module.feature.dto.FeatureCreateRequest;
import com.treehouse.module.feature.dto.FeatureVO;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/feature")
@RequiredArgsConstructor
public class FeatureController extends BaseController {

    private final FeatureService featureService;

    /** 全站功能列表（按票数降序） */
    @GetMapping("/list")
    public R<List<FeatureVO>> list(HttpServletRequest request,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size) {
        return R.ok(featureService.list(page, size, currentUserId(request)));
    }

    /** 我提的功能 */
    @GetMapping("/mine")
    public R<List<FeatureVO>> mine(HttpServletRequest request,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size) {
        return R.ok(featureService.mine(currentUserId(request), page, size));
    }

    /** 提交建议 */
    @PostMapping("/create")
    public R<FeatureVO> create(HttpServletRequest request,
                               @RequestBody @Validated FeatureCreateRequest req) {
        return R.ok(featureService.create(currentUserId(request), req));
    }

    /** 投票/取消票 */
    @PostMapping("/vote/{id}")
    public R<FeatureVO> vote(HttpServletRequest request,
                             @PathVariable Long id) {
        return R.ok(featureService.vote(currentUserId(request), id));
    }
}
