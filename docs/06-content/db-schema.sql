-- 今夜树屋 · 数据库 DDL
-- MySQL 8.0+ · utf8mb4 · InnoDB
-- 4 个业务模块表 + 已有 user/coin 扩字段

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ==================== 已有表（扩字段） ====================

-- t_user：会员状态、最后活跃时间
ALTER TABLE t_user
  ADD COLUMN last_active_at  DATETIME     DEFAULT NULL COMMENT '最后活跃时间',
  ADD COLUMN is_anonymous    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '匿名模式：0-否 1-是';

-- t_coin_log：补 remark 字段（运营查账用）
ALTER TABLE t_coin_log
  ADD COLUMN remark  VARCHAR(200) DEFAULT NULL COMMENT '流水备注';

-- ==================== 深夜信箱（letter） ====================

DROP TABLE IF EXISTS t_letter;
CREATE TABLE t_letter (
  id              BIGINT          NOT NULL AUTO_INCREMENT            COMMENT '主键',
  user_id         BIGINT          NOT NULL                            COMMENT '作者用户 ID',
  letter_no       VARCHAR(32)     NOT NULL                            COMMENT '信件编号 L-yyyyMMdd-NNNN',
  receiver_type   VARCHAR(20)     NOT NULL                            COMMENT '收信人：self_future/self_now/missed_one/stranger',
  content         VARBINARY(4000) NOT NULL                            COMMENT '正文 AES 密文（BASE64 解码后二进制存）',
  envelope_code   VARCHAR(20)     NOT NULL DEFAULT 'default'          COMMENT '信封样式：default/kraft/sakura',
  ai_enabled      TINYINT(1)      NOT NULL DEFAULT 0                  COMMENT '是否启用 AI 回信：0/1',
  ai_persona      VARCHAR(20)     DEFAULT NULL                        COMMENT 'AI 人设：SISTER/BESTIE/PROF/BUDDHA/STAR',
  ai_reply        TEXT            DEFAULT NULL                        COMMENT 'AI 回信（明文）',
  public_to_wall  TINYINT(1)      NOT NULL DEFAULT 0                  COMMENT '是否公开到漂流墙：0/1',
  deliver_at      DATETIME        NOT NULL                            COMMENT '计划送达时间',
  delivered_at    DATETIME        DEFAULT NULL                        COMMENT '实际送达时间',
  status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING'          COMMENT '状态：PENDING/DELIVERED/REPLIED/CANCELED',
  deleted         TINYINT(1)      NOT NULL DEFAULT 0                  COMMENT '软删除',
  create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
  update_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_letter_no (letter_no),
  KEY idx_user_status_create (user_id, status, create_time),
  KEY idx_status_deliver (status, deliver_at),
  KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='深夜信箱';

-- ==================== 塔罗盲盒（tarot） ====================

DROP TABLE IF EXISTS t_tarot_card;
CREATE TABLE t_tarot_card (
  id              BIGINT          NOT NULL AUTO_INCREMENT            COMMENT '主键（牌 ID 1-78）',
  arcana          VARCHAR(10)     NOT NULL                            COMMENT '大/小阿卡纳：MAJOR/MINOR',
  suit            VARCHAR(10)     DEFAULT NULL                        COMMENT '小阿卡纳花色：WANDS/CUPS/SWORDS/PENTACLES',
  number          INT             NOT NULL                            COMMENT '牌序号（0-21 大，1-14 小）',
  name_cn         VARCHAR(50)     NOT NULL                            COMMENT '中文名',
  name_en         VARCHAR(50)     NOT NULL                            COMMENT '英文名',
  upright_kw      VARCHAR(200)    NOT NULL                            COMMENT '正位关键词（逗号分隔）',
  reversed_kw     VARCHAR(200)    NOT NULL                            COMMENT '逆位关键词',
  image_url       VARCHAR(500)    DEFAULT NULL                        COMMENT '牌面图（可选）',
  deleted         TINYINT(1)      NOT NULL DEFAULT 0,
  create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_card_no (arcana, suit, number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='塔罗牌库';

DROP TABLE IF EXISTS t_tarot_reading;
CREATE TABLE t_tarot_reading (
  id                BIGINT        NOT NULL AUTO_INCREMENT            COMMENT '主键',
  user_id           BIGINT        NOT NULL                            COMMENT '用户 ID',
  reading_no        VARCHAR(32)   NOT NULL                            COMMENT '占卜编号 T-yyyyMMdd-NNNN',
  spread_type       VARCHAR(20)   NOT NULL                            COMMENT '牌阵：DAILY/THREE_CARDS',
  question          VARCHAR(500)  DEFAULT NULL                        COMMENT '用户问题（仅三牌阵）',
  cards_json        VARCHAR(1000) NOT NULL                            COMMENT '抽中的牌 JSON [{cardId,name,position,keywords}]',
  short_interp      VARCHAR(500)  NOT NULL                            COMMENT '30 字短解读',
  full_interp       TEXT          DEFAULT NULL                        COMMENT '200 字完整解读（解锁后）',
  advice_json       VARCHAR(500)  DEFAULT NULL                        COMMENT '建议数组 JSON',
  lucky_color       VARCHAR(20)   DEFAULT NULL                        COMMENT '幸运色',
  lucky_number      INT           DEFAULT NULL                        COMMENT '幸运数字',
  song_url          VARCHAR(500)  DEFAULT NULL                        COMMENT '推荐歌曲（占位）',
  unlock_price      INT           NOT NULL DEFAULT 990                COMMENT '解锁价格（分）',
  unlocked          TINYINT(1)    NOT NULL DEFAULT 0                  COMMENT '是否已解锁：0/1',
  order_id          VARCHAR(32)   DEFAULT NULL                        COMMENT '解锁订单号',
  draw_date         DATE          NOT NULL                            COMMENT '抽签日期（每日一抽限定）',
  deleted           TINYINT(1)    NOT NULL DEFAULT 0,
  create_time       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reading_no (reading_no),
  KEY idx_user_drawdate (user_id, draw_date),
  KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='塔罗占卜记录';

-- ==================== 许愿池（wish） ====================

DROP TABLE IF EXISTS t_wish;
CREATE TABLE t_wish (
  id              BIGINT          NOT NULL AUTO_INCREMENT            COMMENT '主键',
  user_id         BIGINT          NOT NULL                            COMMENT '许愿人',
  wish_no         VARCHAR(32)     NOT NULL                            COMMENT '愿望编号 W-yyyyMMdd-NNNN',
  category        VARCHAR(20)     NOT NULL                            COMMENT '分类：study/career/love/health/other',
  content         VARCHAR(500)    NOT NULL                            COMMENT '愿望内容',
  expect_at       DATETIME        DEFAULT NULL                        COMMENT '期望实现时间',
  public_to_wall  TINYINT(1)      NOT NULL DEFAULT 0                  COMMENT '是否公开到漂流墙',
  status          VARCHAR(20)     NOT NULL DEFAULT 'OPEN'             COMMENT '状态：OPEN/ACHIEVED/CLOSED/EXPIRED',
  achieved        TINYINT(1)      DEFAULT NULL                        COMMENT '是否实现：0-否 1-是（结愿时填）',
  blessing        TEXT            DEFAULT NULL                        COMMENT '结愿时的月光祝福',
  tap_count       INT             NOT NULL DEFAULT 0                  COMMENT '本愿望累计木鱼敲击（功德 +N）',
  deleted         TINYINT(1)      NOT NULL DEFAULT 0,
  create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_wish_no (wish_no),
  KEY idx_user_status (user_id, status),
  KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='许愿池';

DROP TABLE IF EXISTS t_mokugyo_log;
CREATE TABLE t_mokugyo_log (
  id              BIGINT          NOT NULL AUTO_INCREMENT            COMMENT '主键',
  user_id         BIGINT          NOT NULL                            COMMENT '用户',
  count           INT             NOT NULL                            COMMENT '本次上报敲击次数（批量）',
  total_merit     BIGINT          NOT NULL                            COMMENT '用户累计功德（落库时算）',
  day             DATE            NOT NULL                            COMMENT '敲击日期（按天统计每日上限）',
  create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_day (user_id, day),
  KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='木鱼敲击记录（每日上限 100 次）';

-- ==================== 漂流墙（bottle） ====================

DROP TABLE IF EXISTS t_bottle;
CREATE TABLE t_bottle (
  id              BIGINT          NOT NULL AUTO_INCREMENT            COMMENT '主键',
  user_id         BIGINT          NOT NULL                            COMMENT '投递人（匿名池里屏蔽）',
  bottle_no       VARCHAR(32)     NOT NULL                            COMMENT '瓶子编号 B-yyyyMMdd-NNNN',
  content         VARCHAR(500)    NOT NULL                            COMMENT '心事正文（已脱敏）',
  tags_json       VARCHAR(200)    DEFAULT NULL                        COMMENT '情绪标签 JSON 数组',
  anonymous_id    VARCHAR(32)     NOT NULL                            COMMENT '匿名 ID：路人-A7B3',
  warm_count      INT             NOT NULL DEFAULT 0                  COMMENT '被温暖次数',
  audit_status    VARCHAR(20)     NOT NULL DEFAULT 'PENDING'          COMMENT '审核：PENDING/PASSED/REJECTED',
  deleted         TINYINT(1)      NOT NULL DEFAULT 0,
  create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_bottle_no (bottle_no),
  KEY idx_audit_create (audit_status, create_time),
  KEY idx_warm (warm_count DESC, create_time DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='漂流墙瓶子';

DROP TABLE IF EXISTS t_bottle_warm;
CREATE TABLE t_bottle_warm (
  id              BIGINT          NOT NULL AUTO_INCREMENT            COMMENT '主键',
  bottle_id       BIGINT          NOT NULL                            COMMENT '瓶子 ID',
  user_id         BIGINT          NOT NULL                            COMMENT '温暖者',
  gift_type       VARCHAR(20)     NOT NULL                            COMMENT '礼物：hug/candy/candle',
  coin_cost       INT             NOT NULL DEFAULT 0                  COMMENT '花费月光币',
  create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_bottle_user (bottle_id, user_id)                       COMMENT '同一用户对同一瓶子只温暖一次',
  KEY idx_user_create (user_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='温暖记录';

SET FOREIGN_KEY_CHECKS = 1;

-- ==================== 塔罗 78 张初始数据 ====================

INSERT INTO t_tarot_card (arcana, suit, number, name_cn, name_en, upright_kw, reversed_kw) VALUES
-- 大阿卡纳 22 张
('MAJOR', NULL, 0,  '愚者',       'The Fool',          '新开始,自由,纯真',             '鲁莽,犹豫,迷失'),
('MAJOR', NULL, 1,  '魔术师',     'The Magician',      '创造力,行动力,专注',            '欺骗,操控,犹豫'),
('MAJOR', NULL, 2,  '女祭司',     'The High Priestess','直觉,潜意识,神秘',              '秘密,疏离,忽视直觉'),
('MAJOR', NULL, 3,  '皇后',       'The Empress',       '丰盛,母性,自然',                '依赖,停滞,过度保护'),
('MAJOR', NULL, 4,  '皇帝',       'The Emperor',       '权威,结构,稳定',                '专制,僵化,控制欲'),
('MAJOR', NULL, 5,  '教皇',       'The Hierophant',    '传统,信仰,指引',                '教条,叛逆,盲从'),
('MAJOR', NULL, 6,  '恋人',       'The Lovers',        '爱,选择,和谐',                  '矛盾,失衡,错误选择'),
('MAJOR', NULL, 7,  '战车',       'The Chariot',       '意志,胜利,前进',                '失控,停滞,内心冲突'),
('MAJOR', NULL, 8,  '力量',       'Strength',          '勇气,内在力量,耐心',            '软弱,自我怀疑,被压垮'),
('MAJOR', NULL, 9,  '隐者',       'The Hermit',        '内省,独处,智慧',                '孤立,封闭,逃避'),
('MAJOR', NULL, 10, '命运之轮',   'Wheel of Fortune',  '转折,机遇,循环',                '厄运,抗拒,停滞'),
('MAJOR', NULL, 11, '正义',       'Justice',           '公平,真相,因果',                '不公,逃避责任,偏见'),
('MAJOR', NULL, 12, '倒吊人',     'The Hanged Man',    '放下,新视角,等待',              '抗拒,牺牲,徒劳'),
('MAJOR', NULL, 13, '死神',       'Death',             '结束,转化,新生',                '抗拒改变,停滞,恐惧'),
('MAJOR', NULL, 14, '节制',       'Temperance',        '平衡,耐心,调和',                '失衡,过度,急躁'),
('MAJOR', NULL, 15, '恶魔',       'The Devil',         '束缚,欲望,执着',                '挣脱,觉醒,放下'),
('MAJOR', NULL, 16, '塔',         'The Tower',         '突变,崩塌,觉醒',                '抗拒灾难,逃避,延迟'),
('MAJOR', NULL, 17, '星星',       'The Star',          '希望,灵感,治愈',                '绝望,迷失信心,灰心'),
('MAJOR', NULL, 18, '月亮',       'The Moon',          '幻象,潜意识,不安',              '真相浮现,释放恐惧,清晰'),
('MAJOR', NULL, 19, '太阳',       'The Sun',           '快乐,成功,活力',                '短暂阴霾,自我怀疑,延迟'),
('MAJOR', NULL, 20, '审判',       'Judgement',         '觉醒,重生,召唤',                '自我怀疑,逃避,犹豫'),
('MAJOR', NULL, 21, '世界',       'The World',         '圆满,完成,成就',                '未完结,拖延,缺一角');

-- 小阿卡纳 56 张（权杖/圣杯/宝剑/星币 各 14 张：1-10 + 侍从/骑士/王后/国王）
INSERT INTO t_tarot_card (arcana, suit, number, name_cn, name_en, upright_kw, reversed_kw) VALUES
-- 权杖
('MINOR', 'WANDS', 1,  '权杖一',   'Ace of Wands',     '灵感,新机会,创造力',          '拖延,缺乏动力,计划落空'),
('MINOR', 'WANDS', 2,  '权杖二',   'Two of Wands',     '规划,决策,远见',              '恐惧未知,犹豫不决'),
('MINOR', 'WANDS', 3,  '权杖三',   'Three of Wands',   '扩展,远见,等待',              '延迟,挫败,目光短浅'),
('MINOR', 'WANDS', 4,  '权杖四',   'Four of Wands',    '庆祝,和谐,家庭',              '不稳定,过渡期,缺失归属'),
('MINOR', 'WANDS', 5,  '权杖五',   'Five of Wands',    '竞争,冲突,挑战',              '避免冲突,内耗,退缩'),
('MINOR', 'WANDS', 6,  '权杖六',   'Six of Wands',     '胜利,认可,成功',              '失败,自我怀疑,不被认可'),
('MINOR', 'WANDS', 7,  '权杖七',   'Seven of Wands',   '坚守,防御,挑战',              '压力,放弃,被压垮'),
('MINOR', 'WANDS', 8,  '权杖八',   'Eight of Wands',   '快速,行动,进展',              '延迟,慌乱,停滞'),
('MINOR', 'WANDS', 9,  '权杖九',   'Nine of Wands',    '坚韧,警觉,坚持',              '疲惫,偏执,放弃'),
('MINOR', 'WANDS', 10, '权杖十',   'Ten of Wands',     '负担,责任,压力',              '卸下重担,授权,崩塌'),
('MINOR', 'WANDS', 11, '权杖侍从', 'Page of Wands',    '热情,探索,冒险',              '鲁莽,缺乏方向,三分钟热度'),
('MINOR', 'WANDS', 12, '权杖骑士', 'Knight of Wands',  '勇敢,冲动,行动派',            '急躁,鲁莽,不计后果'),
('MINOR', 'WANDS', 13, '权杖王后', 'Queen of Wands',   '独立,自信,魅力',              '自我怀疑,嫉妒,情绪化'),
('MINOR', 'WANDS', 14, '权杖国王', 'King of Wands',    '领导力,远见,果断',            '专制,独断,滥用权力'),
-- 圣杯
('MINOR', 'CUPS', 1,  '圣杯一',   'Ace of Cups',      '爱,情感,直觉',                '拒绝,情感堵塞,空虚'),
('MINOR', 'CUPS', 2,  '圣杯二',   'Two of Cups',      '伙伴,和谐,吸引',              '失衡,误解,疏远'),
('MINOR', 'CUPS', 3,  '圣杯三',   'Three of Cups',    '友谊,庆祝,团聚',              '孤立,过度社交,八卦'),
('MINOR', 'CUPS', 4,  '圣杯四',   'Four of Cups',     '冷漠,沉思,机会',              '开放,接受,错失机会'),
('MINOR', 'CUPS', 5,  '圣杯五',   'Five of Cups',     '失落,悲伤,遗憾',              '接受,前进,看到希望'),
('MINOR', 'CUPS', 6,  '圣杯六',   'Six of Cups',      '怀旧,纯真,回忆',              '困在过去,拒绝成长'),
('MINOR', 'CUPS', 7,  '圣杯七',   'Seven of Cups',    '幻想,选择,诱惑',              '清晰,决心,行动'),
('MINOR', 'CUPS', 8,  '圣杯八',   'Eight of Cups',    '离开,寻找,放下',              '停留,恐惧,回避'),
('MINOR', 'CUPS', 9,  '圣杯九',   'Nine of Cups',     '满足,心愿达成,享受',          '不满足,过度索取,空虚'),
('MINOR', 'CUPS', 10, '圣杯十',   'Ten of Cups',      '家庭幸福,和谐圆满',           '不和谐,家庭冲突,理想化'),
('MINOR', 'CUPS', 11, '圣杯侍从', 'Page of Cups',     '敏感,创意,柔情',              '情绪化,幼稚,易受伤'),
('MINOR', 'CUPS', 12, '圣杯骑士', 'Knight of Cups',   '浪漫,理想,追求',              '情绪化,不切实际,逃避'),
('MINOR', 'CUPS', 13, '圣杯王后', 'Queen of Cups',    '共情,温柔,直觉',              '情绪化,依赖,过度敏感'),
('MINOR', 'CUPS', 14, '圣杯国王', 'King of Cups',     '情感成熟,宽容,平衡',          '情绪操控,冷漠,优柔寡断'),
-- 宝剑
('MINOR', 'SWORDS', 1,  '宝剑一',   'Ace of Swords',    '清晰,真相,突破',              '混乱,误解,思维不清'),
('MINOR', 'SWORDS', 2,  '宝剑二',   'Two of Swords',    '僵局,抉择,平衡',              '逃避决定,信息不足,焦虑'),
('MINOR', 'SWORDS', 3,  '宝剑三',   'Three of Swords',  '心碎,伤痛,分离',              '愈合,原谅,放下'),
('MINOR', 'SWORDS', 4,  '宝剑四',   'Four of Swords',   '休息,恢复,休整',              '倦怠,逃避,停滞'),
('MINOR', 'SWORDS', 5,  '宝剑五',   'Five of Swords',   '冲突,失败,代价',              '和解,放下,寻求共赢'),
('MINOR', 'SWORDS', 6,  '宝剑六',   'Six of Swords',    '过渡,离开,平静',              '困在过去,抗拒改变'),
('MINOR', 'SWORDS', 7,  '宝剑七',   'Seven of Swords',  '策略,隐匿,机敏',              '坦白,诚实,被抓包'),
('MINOR', 'SWORDS', 8,  '宝剑八',   'Eight of Swords',  '束缚,受限,无能为力',          '解放,新视角,突破'),
('MINOR', 'SWORDS', 9,  '宝剑九',   'Nine of Swords',   '焦虑,失眠,恐惧',              '希望,释然,寻求帮助'),
('MINOR', 'SWORDS', 10, '宝剑十',   'Ten of Swords',    '终结,崩溃,触底',              '复苏,新开始,转机'),
('MINOR', 'SWORDS', 11, '宝剑侍从', 'Page of Swords',   '好奇,求知,警觉',              '八卦,鲁莽,多嘴'),
('MINOR', 'SWORDS', 12, '宝剑骑士', 'Knight of Swords', '果断,勇敢,行动力',            '鲁莽,冲动,不计后果'),
('MINOR', 'SWORDS', 13, '宝剑王后', 'Queen of Swords',  '独立,理性,直接',              '冷酷,刻薄,疏离'),
('MINOR', 'SWORDS', 14, '宝剑国王', 'King of Swords',   '智慧,公正,权威',              '专制,冷酷,操控'),
-- 星币
('MINOR', 'PENTACLES', 1,  '星币一',   'Ace of Pentacles',    '新机会,物质,踏实',          '错失机会,不稳定,短视'),
('MINOR', 'PENTACLES', 2,  '星币二',   'Two of Pentacles',    '平衡,灵活,兼顾',           '失衡,过载,顾此失彼'),
('MINOR', 'PENTACLES', 3,  '星币三',   'Three of Pentacles',  '合作,技能,团队',           '不协调,孤立,低效'),
('MINOR', 'PENTACLES', 4,  '星币四',   'Four of Pentacles',   '保守,稳定,占有',           '放手,慷慨,开放'),
('MINOR', 'PENTACLES', 5,  '星币五',   'Five of Pentacles',   '困境,孤立,匮乏',           '转机,寻求帮助,恢复'),
('MINOR', 'PENTACLES', 6,  '星币六',   'Six of Pentacles',    '慷慨,分享,平衡',           '不公,索取,失衡'),
('MINOR', 'PENTACLES', 7,  '星币七',   'Seven of Pentacles',  '耐心,评估,耕耘',           '急躁,放弃,无收获'),
('MINOR', 'PENTACLES', 8,  '星币八',   'Eight of Pentacles',  '勤奋,专注,精进',           '偷工减料,缺乏动力'),
('MINOR', 'PENTACLES', 9,  '星币九',   'Nine of Pentacles',   '独立,成就,自给自足',       '依赖,过度自信,空虚'),
('MINOR', 'PENTACLES', 10, '星币十',   'Ten of Pentacles',    '财富,传承,家族',           '财务危机,家庭冲突'),
('MINOR', 'PENTACLES', 11, '星币侍从', 'Page of Pentacles',   '勤学,新机会,潜力',         '懒散,拖延,缺乏规划'),
('MINOR', 'PENTACLES', 12, '星币骑士', 'Knight of Pentacles', '稳健,可靠,坚持',           '停滞,固执,无聊'),
('MINOR', 'PENTACLES', 13, '星币王后', 'Queen of Pentacles',  '务实,温暖,丰盛',           '过度操心,失衡,物质化'),
('MINOR', 'PENTACLES', 14, '星币国王', 'King of Pentacles',   '成功,稳健,富足',           '贪婪,固执,物质主义');
