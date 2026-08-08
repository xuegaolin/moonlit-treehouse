-- V2__rename_timestamp_columns.sql
-- 2026-08-01
--
-- 问题：BaseEntity 统一映射 @Column(name="create_time")/@Column(name="update_time")，
--       且数十处 Repository 派生查询方法名依赖 createTime（findByUserIdOrderByCreateTimeDesc 等），
--       但数据库表建的是 created_at / updated_at。
--       → Hibernate 报 Unknown column 'user0_.create_time' in 'field list'
--
-- 决策：改数据库，不改代码。代码侧一致性更强，改 Entity 会连带改 19 个 Repository 的方法名。
--
-- 幂等：每条 CHANGE 前用存储过程判断列是否存在，可重复执行。

USE treehouse;

DROP PROCEDURE IF EXISTS rename_col_if_exists;

DELIMITER $$
CREATE PROCEDURE rename_col_if_exists(
    IN p_table   VARCHAR(64),
    IN p_old     VARCHAR(64),
    IN p_new     VARCHAR(64),
    IN p_def     VARCHAR(255)
)
BEGIN
    DECLARE v_old_cnt INT DEFAULT 0;
    DECLARE v_new_cnt INT DEFAULT 0;

    SELECT COUNT(*) INTO v_old_cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_old;

    SELECT COUNT(*) INTO v_new_cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_new;

    IF v_old_cnt = 1 AND v_new_cnt = 0 THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` CHANGE `', p_old, '` `', p_new, '` ', p_def);
        PREPARE stmt FROM @s;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('[OK]   ', p_table, '.', p_old, ' -> ', p_new) AS result;
    ELSEIF v_new_cnt = 1 THEN
        SELECT CONCAT('[SKIP] ', p_table, '.', p_new, ' already exists') AS result;
    ELSE
        SELECT CONCAT('[WARN] ', p_table, '.', p_old, ' not found') AS result;
    END IF;
END$$
DELIMITER ;

SET @CT = 'datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''创建时间''';
SET @UT = 'datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT ''更新时间''';

CALL rename_col_if_exists('t_user',           'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_user',           'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_bailan_license', 'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_bailan_license', 'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_bottle',         'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_bottle',         'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_bottle_warm',    'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_bottle_warm',    'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_coin_log',       'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_letter',         'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_letter',         'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_mokugyo_log',    'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_mokugyo_log',    'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_tarot_card',     'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_tarot_card',     'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_tarot_reading',  'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_tarot_reading',  'updated_at', 'update_time', @UT);
CALL rename_col_if_exists('t_wish',           'created_at', 'create_time', @CT);
CALL rename_col_if_exists('t_wish',           'updated_at', 'update_time', @UT);

-- t_coin_log 缺 update_time（BaseEntity 要求），补上

SET @has_ut = (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_coin_log' AND COLUMN_NAME = 'update_time');
SET @s = IF(@has_ut = 0,
    'ALTER TABLE `t_coin_log` ADD COLUMN `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT ''更新时间''',
    'SELECT ''[SKIP] t_coin_log.update_time already exists'' AS result');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

DROP PROCEDURE IF EXISTS rename_col_if_exists;
