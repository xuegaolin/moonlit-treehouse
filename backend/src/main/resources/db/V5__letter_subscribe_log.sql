-- V5__letter_subscribe_log.sql
-- Module A (Letter Box): one-time subscribe message log
-- 2026-08-06
--
-- Design notes:
--   1) one row per letter (letter_id is UK): no duplicate push, clear state machine
--   2) UK(letter_id): same letter cannot be inserted twice (DB-level guard)
--   3) expire_at = now + 30 days (WeChat push_token TTL)
--      When push_token is expired, log is marked EXPIRED, no error thrown
--   4) state machine: PENDING -> PUSHED / EXPIRED / FAILED
--   5) In dev (no real WeChat openid / template_id) push_token / openid are NULL,
--      log stays PENDING, no real push sent

CREATE TABLE IF NOT EXISTS t_letter_subscribe_log (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  letter_id       VARCHAR(32)  NOT NULL                COMMENT 'letter no L-yyyyMMdd-xxxx',
  openid          VARCHAR(64)           DEFAULT NULL   COMMENT 'user openid, NULL in dev',
  template_id     VARCHAR(64)           DEFAULT NULL   COMMENT 'wechat subscribe template_id',
  push_token      VARCHAR(128)          DEFAULT NULL   COMMENT 'wx.requestSubscribeMessage result, 30-day TTL',
  status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING / PUSHED / EXPIRED / FAILED',
  expire_at       DATETIME              DEFAULT NULL   COMMENT 'push_token expiry time, now + 30 day',
  pushed_at       DATETIME              DEFAULT NULL   COMMENT 'actual push time',
  error_code      VARCHAR(32)           DEFAULT NULL   COMMENT 'wechat errcode on FAILED',
  error_msg       VARCHAR(255)          DEFAULT NULL   COMMENT 'wechat errmsg on FAILED',
  create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time     DATETIME              DEFAULT NULL   ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_letter (letter_id),
  KEY idx_status_expire (status, expire_at),
  KEY idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='letter box subscribe message log';
