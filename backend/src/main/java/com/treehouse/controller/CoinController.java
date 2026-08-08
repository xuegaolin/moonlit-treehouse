package com.treehouse.controller;

import com.treehouse.common.BaseController;
import com.treehouse.common.R;
import com.treehouse.entity.CoinTransaction;
import com.treehouse.service.CoinService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * 月光币控制器
 */
@RestController
@RequestMapping("/coin")
@RequiredArgsConstructor
public class CoinController extends BaseController {

    private final CoinService coinService;

    /**
     * 查询钱包
     *
     * <p>GET /api/v1/coin/wallet → { balance, todayEarned, todayLimit }</p>
     */
    @GetMapping("/wallet")
    public R<Map<String, Object>> wallet(HttpServletRequest request) {
        return R.ok(coinService.walletView(currentUserId(request)));
    }

    /**
     * 查询流水分页
     *
     * <p>GET /api/v1/coin/logs?page=&size= → { list, total }</p>
     */
    @GetMapping("/logs")
    public R<Map<String, Object>> logs(HttpServletRequest request,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size) {
        Page<CoinTransaction> result = coinService.logs(currentUserId(request), page, size);

        Map<String, Object> data = new HashMap<>();
        data.put("list", result.getContent());
        data.put("total", result.getTotalElements());
        return R.ok(data);
    }
}
