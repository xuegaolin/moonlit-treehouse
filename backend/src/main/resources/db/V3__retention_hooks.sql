-- ============================================================
-- 留存钩子 DDL（签到 / 连续天数 / 勋章）
-- 2026-08-03
--
-- 并发设计原则（来自 7/31 并发审计的硬规则）：
--   1. 「用户 × 资源」一律建复合唯一约束，靠 DB 拦重复，不靠应用层 if-exists
--   2. 累加字段用原子 SQL UPDATE ... SET x = x + 1，禁止读-改-写
--   3. 编号/序号列 UNIQUE
-- ============================================================

-- 每日签到记录
-- UK(user_id, checkin_date) 保证同一天只能签一次，并发重复请求由 DB 拒绝
CREATE TABLE IF NOT EXISTS t_checkin (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_id         BIGINT       NOT NULL                COMMENT '用户ID',
    checkin_date    DATE         NOT NULL                COMMENT '签到日期(自然日)',
    streak_days     INT          NOT NULL DEFAULT 1      COMMENT '本次签到后的连续天数',
    coin_reward     INT          NOT NULL DEFAULT 0      COMMENT '本次获得月光币',
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted         TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_date (user_id, checkin_date),
    KEY idx_user_date (user_id, checkin_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日签到';

-- 用户成长档（连续天数 / 累计天数 / 里程碑）
-- 单行一用户，UK(user_id)；streak 更新走原子 SQL
CREATE TABLE IF NOT EXISTS t_user_growth (
    id                  BIGINT      NOT NULL AUTO_INCREMENT,
    user_id             BIGINT      NOT NULL            COMMENT '用户ID',
    current_streak      INT         NOT NULL DEFAULT 0  COMMENT '当前连续签到天数',
    max_streak          INT         NOT NULL DEFAULT 0  COMMENT '历史最长连续天数',
    total_checkin_days  INT         NOT NULL DEFAULT 0  COMMENT '累计签到天数',
    last_checkin_date   DATE                 DEFAULT NULL COMMENT '最后签到日期',
    create_time         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time         DATETIME             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted             TINYINT     NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户成长档';

-- 勋章获得记录
-- UK(user_id, medal_code) 保证同一勋章只发一次，并发由 DB 拦
CREATE TABLE IF NOT EXISTS t_medal (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    user_id       BIGINT       NOT NULL                 COMMENT '用户ID',
    medal_code    VARCHAR(40)  NOT NULL                 COMMENT '勋章编码',
    medal_name    VARCHAR(60)  NOT NULL                 COMMENT '勋章名称(快照)',
    achieved_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
    deleted       TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_medal (user_id, medal_code),
    KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='勋章';
