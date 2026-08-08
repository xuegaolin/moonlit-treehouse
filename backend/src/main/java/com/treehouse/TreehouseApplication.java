package com.treehouse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 今夜树屋 Moonlit Treehouse 后端启动类
 *
 * <p>模块：A深夜信箱 / B摆烂许可证 / C塔罗盲盒 / D许愿池 / E漂流墙 + 月光币 + 会员</p>
 */
@EnableScheduling
@SpringBootApplication
public class TreehouseApplication {

    public static void main(String[] args) {
        SpringApplication.run(TreehouseApplication.class, args);
    }
}
