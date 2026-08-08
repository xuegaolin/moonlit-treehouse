package com.treehouse.module.tarot;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * 塔罗牌仓库
 */
@Repository
public interface TarotCardRepository extends JpaRepository<TarotCard, Long> {
    /** 按 ID 批量取牌 */
    List<TarotCard> findByIdIn(List<Long> ids);
}
