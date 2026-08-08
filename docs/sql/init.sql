-- =====================================================================
-- 今夜树屋 Moonlit Treehouse - 初始化 DDL
-- Generated: 2026-07-31
-- v1.5 同步: 2026-08-08
-- MySQL 8.0+ / utf8mb4
-- 重置策略：DROP 现有表后重建（仅 MVP 阶段使用）
--
-- v1.5 改动：
--   - t_user 加 real_name_verified / chat_enabled / friend_enabled / chat_history_keep_days
--   - t_bailan_license 列名对齐 entity（license_no / license_type / template_code / reason_text）
--   - 新增 t_coin_wallet（live DB 自动建出来的）
--   - 新增 t_chat_message（v1.5 聊天表，已在 live DB）
--   - 新增 t_feature_request / t_feature_vote（v1.5 功能投票表，已在 live DB）
-- =====================================================================

DROP DATABASE IF EXISTS treehouse;
CREATE DATABASE treehouse
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE treehouse;

-- =====================================================================
-- 模块 0: 用户 / 月光币（通用基础）
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_user (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    openid          VARCHAR(64)  NOT NULL,
    unionid         VARCHAR(64),
    nickname        VARCHAR(64),
    avatar          VARCHAR(500),
    member_expire_at DATETIME,

    -- v1.5 隐私与社交开关
    real_name_verified       TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '微信一键实名通过=1',
    chat_enabled             TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '是否开放聊天（付费用户可开启）',
    friend_enabled           TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '是否开放加好友',
    chat_history_keep_days   INT         NOT NULL DEFAULT 7 COMMENT '聊天记录保存天数：7/30/90/-1=永久',

    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_user_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 月光币钱包（v1.5 live DB 已有；entity: CoinAccount）
CREATE TABLE IF NOT EXISTS t_coin_wallet (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    balance         INT          NOT NULL DEFAULT 0,
    today_earned    INT          NOT NULL DEFAULT 0,
    today_limit     INT          NOT NULL DEFAULT 30,    -- v1.5: 100 → 30（饥饿营销）
    create_time     DATETIME(6)  NOT NULL,
    update_time     DATETIME(6)  NOT NULL,
    UNIQUE KEY uk_wallet_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS t_coin_log (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    amount          INT          NOT NULL,
    type            VARCHAR(20)  NOT NULL,        -- BAILAN_DAILY / MOKUGYO_MERIT / BOTTLE_WARM / CHECKIN / CHAT_KEEP_DAYS
    ref_id          VARCHAR(64),
    balance_after   INT          NOT NULL,
    create_time     DATETIME(6)  NOT NULL,
    KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 模块 A: 摆烂许可证（t_bailan_license）
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_bailan_license (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    license_no      VARCHAR(32)  NOT NULL,        -- 许可证编号，如 ML-20260807-0001
    license_type    VARCHAR(20)  NOT NULL,        -- monday/period/breakup/no_reason/ai_custom
    template_code   VARCHAR(20)  NOT NULL,        -- gov/handwrite/palace/cyber
    reason_text     VARCHAR(500) NOT NULL,        -- 摆烂理由
    image_url       VARCHAR(500),                 -- 服务端出图预留（MVP 端侧 canvas）
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_license_no (license_no),
    KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 模块 B: 深夜信箱（t_letter）
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_letter (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    letter_no       VARCHAR(32)  NOT NULL,
    receiver_type   VARCHAR(20)  NOT NULL,
    content         TEXT         NOT NULL,        -- AES 密文
    summary         VARCHAR(120) NOT NULL,        -- 60 字摘要（明文）
    envelope_code   VARCHAR(20)  NOT NULL DEFAULT 'default',
    ai_enabled      TINYINT(1)   NOT NULL DEFAULT 0,
    ai_persona      VARCHAR(20),
    ai_reply        TEXT,
    public_to_wall  TINYINT(1)   NOT NULL DEFAULT 0,
    deliver_at      DATETIME     NOT NULL,
    delivered_at    DATETIME,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_letter_no (letter_no),
    KEY idx_user_status_create (user_id, status, created_at),
    KEY idx_status_deliver (status, deliver_at),
    KEY idx_user_create (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 模块 C: 塔罗（t_tarot_card + t_tarot_reading）
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_tarot_card (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    arcana          VARCHAR(10)  NOT NULL,
    suit            VARCHAR(20),
    number          INT          NOT NULL,
    name_cn         VARCHAR(40)  NOT NULL,
    name_en         VARCHAR(60)  NOT NULL,
    upright_kw      VARCHAR(200) NOT NULL,
    reversed_kw     VARCHAR(200) NOT NULL,
    upright_meaning TEXT,
    reversed_meaning TEXT,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_card_no (arcana, suit, number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS t_tarot_reading (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    reading_no      VARCHAR(32)  NOT NULL,
    spread_type     VARCHAR(20)  NOT NULL,
    question        VARCHAR(500),
    cards_json      VARCHAR(2000) NOT NULL,
    short_interp    VARCHAR(500) NOT NULL,
    full_interp     TEXT,
    advice_json     VARCHAR(500),
    lucky_color     VARCHAR(20),
    lucky_number    INT,
    song_url        VARCHAR(500),
    unlock_price    INT          NOT NULL DEFAULT 990,
    unlocked        TINYINT(1)   NOT NULL DEFAULT 0,
    order_id        VARCHAR(32),
    draw_date       DATE         NOT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_reading_no (reading_no),
    UNIQUE KEY uk_user_spread_day (user_id, spread_type, draw_date),
    KEY idx_user_drawdate (user_id, draw_date),
    KEY idx_user_create (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 模块 D: 许愿池 / 木鱼（t_wish + t_mokugyo_log）
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_wish (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    wish_no         VARCHAR(32)  NOT NULL,
    category        VARCHAR(20)  NOT NULL,
    content         VARCHAR(500) NOT NULL,
    expect_at       DATETIME,
    public_to_wall  TINYINT(1)   NOT NULL DEFAULT 0,
    status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    achieved        TINYINT(1),
    blessing        TEXT,
    tap_count       INT          NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_wish_no (wish_no),
    KEY idx_user_status (user_id, status),
    KEY idx_user_create (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS t_mokugyo_log (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    `count`         INT          NOT NULL,
    total_merit     BIGINT       NOT NULL,
    day             DATE         NOT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    KEY idx_user_day (user_id, day),
    KEY idx_user_create (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 模块 E: 漂流墙（t_bottle + t_bottle_warm）
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_bottle (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    bottle_no       VARCHAR(32)  NOT NULL,
    content         VARCHAR(500) NOT NULL,
    tags_json       VARCHAR(200),
    anonymous_id    VARCHAR(32)  NOT NULL,
    warm_count      INT          NOT NULL DEFAULT 0,
    audit_status    VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_bottle_no (bottle_no),
    KEY idx_audit_create (audit_status, created_at),
    KEY idx_warm (warm_count, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS t_bottle_warm (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    bottle_id       BIGINT       NOT NULL,
    user_id         BIGINT       NOT NULL,
    gift_type       VARCHAR(20)  NOT NULL,
    coin_cost       INT          NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_bottle_user (bottle_id, user_id),
    KEY idx_user_create (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 模块 F (v1.5): 聊天消息（仅付费+实名用户可用）
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_chat_session (
    id                  BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_a_id           BIGINT       NOT NULL,
    user_b_id           BIGINT       NOT NULL,
    last_msg_id         BIGINT,
    last_msg_preview    VARCHAR(100),
    last_msg_at         DATETIME,
    user_a_unread       INT          NOT NULL DEFAULT 0,
    user_b_unread       INT          NOT NULL DEFAULT 0,
    user_a_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
    user_b_deleted      TINYINT(1)   NOT NULL DEFAULT 0,
    create_time         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted             TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_session_pair (user_a_id, user_b_id),
    KEY idx_user_a (user_a_id, last_msg_at),
    KEY idx_user_b (user_b_id, last_msg_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天会话（v1.5）';

CREATE TABLE IF NOT EXISTS t_chat_message (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    from_user_id    BIGINT       NOT NULL,
    to_user_id      BIGINT       NOT NULL,
    content         TEXT         NOT NULL,
    msg_type        VARCHAR(20)  NOT NULL DEFAULT 'TEXT',   -- TEXT/IMAGE/SYSTEM
    audited         TINYINT(1)   NOT NULL DEFAULT 0,         -- AI 审核通过
    audit_result    VARCHAR(20),                            -- PASS/REJECT/REVIEW
    read_at         DATETIME,
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expired_at      DATETIME,                                -- 过期时间（按 keep_days 算）
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    KEY idx_from_create (from_user_id, create_time),
    KEY idx_to_create (to_user_id, create_time),
    KEY idx_expire (expired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='私聊消息（v1.5）';

CREATE TABLE IF NOT EXISTS t_chat_friend (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    friend_id       BIGINT       NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING/ACCEPTED/BLOCKED
    remark          VARCHAR(50),
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uk_friend_pair (user_id, friend_id),
    KEY idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='好友关系（v1.5）';

-- =====================================================================
-- 模块 G (v1.5): 用户功能建议 + 投票
-- =====================================================================

CREATE TABLE IF NOT EXISTS t_feature_request (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    title           VARCHAR(80)  NOT NULL,
    description     VARCHAR(500) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN',   -- OPEN/PLANNED/DONE/REJECTED
    vote_count      INT          NOT NULL DEFAULT 0,
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    KEY idx_status_vote (status, vote_count),
    KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户功能建议+投票（v1.5）';

CREATE TABLE IF NOT EXISTS t_feature_vote (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    feature_id      BIGINT       NOT NULL,
    create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_feature (user_id, feature_id),
    KEY idx_feature (feature_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='功能投票（每用户每 feature 1 票）';

-- =====================================================================
-- 塔罗 78 张牌种子数据
-- =====================================================================

INSERT IGNORE INTO t_tarot_card (arcana, suit, number, name_cn, name_en, upright_kw, reversed_kw) VALUES
('MAJOR', NULL, 0,  '愚者',     'The Fool',          '新开始, 自由, 纯真',          '鲁莽, 犹豫, 迷失'),
('MAJOR', NULL, 1,  '魔术师',   'The Magician',      '创造力, 行动力, 专注',        '欺骗, 操纵, 自我怀疑'),
('MAJOR', NULL, 2,  '女祭司',   'The High Priestess','直觉, 潜意识, 智慧',          '忽视直觉, 表面化'),
('MAJOR', NULL, 3,  '皇后',     'The Empress',       '丰盛, 滋养, 美',              '依赖, 过度保护'),
('MAJOR', NULL, 4,  '皇帝',     'The Emperor',       '权威, 稳定, 父亲能量',        '专制, 僵化'),
('MAJOR', NULL, 5,  '教皇',     'The Hierophant',    '传统, 教导, 信仰',            '教条, 反叛'),
('MAJOR', NULL, 6,  '恋人',     'The Lovers',        '爱, 关系, 选择',              '失衡, 逃避选择'),
('MAJOR', NULL, 7,  '战车',     'The Chariot',       '意志, 胜利, 自律',            '失控, 失去方向'),
('MAJOR', NULL, 8,  '力量',     'Strength',          '勇气, 内在力量, 耐心',        '软弱, 自我怀疑'),
('MAJOR', NULL, 9,  '隐士',     'The Hermit',        '内省, 独处, 寻找真理',        '孤立, 拒绝指引'),
('MAJOR', NULL, 10, '命运之轮', 'Wheel of Fortune',  '变化, 转折, 命运',            '厄运, 抗拒改变'),
('MAJOR', NULL, 11, '正义',     'Justice',           '真相, 公平, 因果',            '不公, 逃避责任'),
('MAJOR', NULL, 12, '倒吊人',   'The Hanged Man',    '牺牲, 新视角, 等待',          '无谓牺牲, 拖延'),
('MAJOR', NULL, 13, '死神',     'Death',             '结束, 转变, 释放',            '抗拒改变, 停滞'),
('MAJOR', NULL, 14, '节制',     'Temperance',        '平衡, 调和, 耐心',            '失衡, 过度'),
('MAJOR', NULL, 15, '恶魔',     'The Devil',         '束缚, 欲望, 执着',            '挣脱, 觉醒'),
('MAJOR', NULL, 16, '塔',       'The Tower',         '突变, 崩塌, 启示',            '避免灾难, 抗拒改变'),
('MAJOR', NULL, 17, '星星',     'The Star',          '希望, 灵感, 治愈',            '绝望, 失去信心'),
('MAJOR', NULL, 18, '月亮',     'The Moon',          '幻象, 潜意识, 直觉',          '困惑, 恐惧'),
('MAJOR', NULL, 19, '太阳',     'The Sun',           '快乐, 成功, 活力',            '沮丧, 缺乏自信'),
('MAJOR', NULL, 20, '审判',     'Judgement',         '觉醒, 宽恕, 重生',            '自我怀疑, 拒绝召唤'),
('MAJOR', NULL, 21, '世界',     'The World',         '完成, 圆满, 成就',            '未完成, 延迟'),
('MINOR', 'WANDS',     1, '权杖王牌', 'Ace of Wands',     '灵感, 创造, 新机会',  '延迟, 缺乏动力'),
('MINOR', 'WANDS',     2, '权杖二',   'Two of Wands',     '规划, 决策, 远见',    '恐惧改变, 犹豫'),
('MINOR', 'WANDS',     3, '权杖三',   'Three of Wands',   '扩展, 远航, 等待',    '延迟, 局限视野'),
('MINOR', 'WANDS',    14, '权杖国王', 'King of Wands',    '领导力, 远见, 成熟',  '专横, 鲁莽');

-- =====================================================================
-- 索引 / 约束总结
-- =====================================================================
-- t_user:                uk_user_openid
-- t_coin_wallet:         uk_wallet_user
-- t_coin_log:            idx_user_create
-- t_bailan_license:      uk_license_no
-- t_letter:              uk_letter_no + 3 索引
-- t_tarot_card:          uk_card_no（arcana, suit, number）
-- t_tarot_reading:       uk_reading_no + uk_user_spread_day（防双抽）
-- t_wish:                uk_wish_no + idx_user_status
-- t_mokugyo_log:         idx_user_day（每日上限）
-- t_bottle:              uk_bottle_no + idx_audit_create + idx_warm
-- t_bottle_warm:         uk_bottle_user（防重复温暖）
-- t_chat_session:        uk_session_pair（双方唯一） + idx_user_a/b
-- t_chat_message:        idx_from_create + idx_to_create + idx_expire
-- t_chat_friend:         uk_friend_pair + idx_user_status
-- t_feature_request:     idx_status_vote + idx_user_create
-- t_feature_vote:        uk_user_feature（每用户每 feature 1 票）
