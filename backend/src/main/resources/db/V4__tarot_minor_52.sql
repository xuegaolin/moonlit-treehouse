-- V4__tarot_minor_52.sql
-- 补齐塔罗小牌至 78 张全套（现有 26 张：MAJOR 22 + WANDS 1/2/3/14）
-- 幂等：按 (arcana,suit,number) 判重，重复执行不会产生脏数据

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',4,'权杖四','Four of Wands','庆祝, 安定, 归属','不安, 缺乏归属感'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=4);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',5,'权杖五','Five of Wands','竞争, 摩擦, 内耗','避免冲突, 妥协'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=5);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',6,'权杖六','Six of Wands','胜利, 被认可, 荣耀','骄傲, 名不副实'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=6);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',7,'权杖七','Seven of Wands','坚守, 防御, 压力','力不从心, 想放弃'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=7);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',8,'权杖八','Eight of Wands','迅速, 进展, 消息','延迟, 混乱'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=8);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',9,'权杖九','Nine of Wands','疲惫但坚持, 警惕','固执, 硬撑'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=9);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',10,'权杖十','Ten of Wands','重担, 责任过多','放下负担, 卸载'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=10);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',11,'权杖侍从','Page of Wands','好奇, 跃跃欲试','轻率, 三分钟热度'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=11);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',12,'权杖骑士','Knight of Wands','行动, 冒险, 冲劲','鲁莽, 半途而废'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=12);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','WANDS',13,'权杖王后','Queen of Wands','热情, 魅力, 自信','强势, 情绪化'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='WANDS' AND number=13);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',1,'圣杯王牌','Ace of Cups','新感情, 心动, 满溢','情感压抑, 空虚'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=1);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',2,'圣杯二','Two of Cups','共鸣, 联结, 相互','失衡, 单方付出'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=2);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',3,'圣杯三','Three of Cups','友谊, 分享, 热闹','孤立, 塑料情谊'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=3);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',4,'圣杯四','Four of Cups','厌倦, 不满足, 回避','重新接受, 醒悟'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=4);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',5,'圣杯五','Five of Cups','失落, 遗憾, 沉溺过去','接受, 走出来'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=5);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',6,'圣杯六','Six of Cups','怀旧, 童年, 温柔回忆','沉溺过去, 不肯长大'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=6);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',7,'圣杯七','Seven of Cups','幻想, 选择太多','看清现实, 清醒'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=7);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',8,'圣杯八','Eight of Cups','离开, 转身, 寻找更好','徘徊, 不敢走'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=8);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',9,'圣杯九','Nine of Cups','满足, 心愿达成','虚假满足, 贪心'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=9);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',10,'圣杯十','Ten of Cups','圆满, 归属, 家','关系裂痕, 表面和谐'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=10);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',11,'圣杯侍从','Page of Cups','敏感, 直觉, 纯粹','情绪化, 幼稚'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=11);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',12,'圣杯骑士','Knight of Cups','浪漫, 追随内心','不切实际, 逃避'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=12);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',13,'圣杯王后','Queen of Cups','共情, 温柔, 包容','过度付出, 情绪淹没'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=13);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','CUPS',14,'圣杯国王','King of Cups','情绪成熟, 沉稳温和','压抑, 情感操控'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='CUPS' AND number=14);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',1,'宝剑王牌','Ace of Swords','清晰, 真相, 突破','混乱, 判断失误'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=1);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',2,'宝剑二','Two of Swords','僵局, 难以决定','被迫选择, 打破僵局'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=2);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',3,'宝剑三','Three of Swords','心痛, 被伤害, 真话','疗愈开始, 释怀'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=3);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',4,'宝剑四','Four of Swords','休息, 暂停, 恢复','强撑, 该停却不停'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=4);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',5,'宝剑五','Five of Swords','冲突, 赢了却空虚','和解, 放下胜负'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=5);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',6,'宝剑六','Six of Swords','过渡, 离开困境','停滞, 走不出来'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=6);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',7,'宝剑七','Seven of Swords','隐瞒, 走捷径','坦白, 被揭穿'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=7);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',8,'宝剑八','Eight of Swords','自我设限, 感觉被困','松绑, 发现出口'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=8);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',9,'宝剑九','Nine of Swords','焦虑, 深夜失眠, 反刍','缓解, 说出恐惧'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=9);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',10,'宝剑十','Ten of Swords','触底, 结束, 最坏已过','复原, 慢慢好转'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=10);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',11,'宝剑侍从','Page of Swords','好奇, 直言, 观察','刺人, 说话不留情'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=11);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',12,'宝剑骑士','Knight of Swords','果断, 直冲, 效率','急躁, 伤人伤己'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=12);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',13,'宝剑王后','Queen of Swords','独立, 清醒, 界限','冷漠, 尖锐'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=13);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','SWORDS',14,'宝剑国王','King of Swords','理性, 公正, 判断力','严苛, 冷酷'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='SWORDS' AND number=14);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',1,'星币王牌','Ace of Pentacles','新机会, 实际收获','错失, 短视'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=1);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',2,'星币二','Two of Pentacles','平衡, 兼顾, 灵活','失衡, 顾此失彼'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=2);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',3,'星币三','Three of Pentacles','协作, 被认可的技能','各行其是, 质量差'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=3);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',4,'星币四','Four of Pentacles','守护, 安全感, 抓紧','吝啬, 不敢放手'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=4);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',5,'星币五','Five of Pentacles','匮乏, 孤立无援','援助出现, 转机'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=5);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',6,'星币六','Six of Pentacles','给予, 互助, 慷慨','不对等, 施舍感'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=6);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',7,'星币七','Seven of Pentacles','耐心, 长期投入','不耐烦, 想放弃'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=7);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',8,'星币八','Eight of Pentacles','专注, 打磨, 熟练','重复枯燥, 敷衍'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=8);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',9,'星币九','Nine of Pentacles','自足, 独立享受成果','依赖, 空虚的富足'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=9);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',10,'星币十','Ten of Pentacles','稳固, 传承, 长久','家庭压力, 得失焦虑'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=10);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',11,'星币侍从','Page of Pentacles','学习, 踏实起步','不专心, 拖延'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=11);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',12,'星币骑士','Knight of Pentacles','稳步, 可靠, 坚持','停滞, 固执保守'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=12);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',13,'星币王后','Queen of Pentacles','务实, 滋养, 踏实','过度操心, 物质焦虑'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=13);

INSERT INTO t_tarot_card (arcana,suit,number,name_cn,name_en,upright_kw,reversed_kw)
SELECT 'MINOR','PENTACLES',14,'星币国王','King of Pentacles','富足, 稳健, 掌控','控制欲, 唯利是图'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tarot_card
  WHERE arcana='MINOR' AND suit='PENTACLES' AND number=14);
