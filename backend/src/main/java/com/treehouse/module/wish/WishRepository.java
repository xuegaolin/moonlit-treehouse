package com.treehouse.module.wish;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface WishRepository extends JpaRepository<Wish, Long> {
    boolean existsByWishNo(String wishNo);
    Optional<Wish> findByWishNoAndUserId(String wishNo, Long userId);
    List<Wish> findByUserIdOrderByCreateTimeDesc(Long userId);

    @Query("SELECT COUNT(w) FROM Wish w WHERE w.createTime BETWEEN :start AND :end")
    long countByCreateTimeBetween(@Param("start") java.time.LocalDateTime start,
                                  @Param("end") java.time.LocalDateTime end);
}
