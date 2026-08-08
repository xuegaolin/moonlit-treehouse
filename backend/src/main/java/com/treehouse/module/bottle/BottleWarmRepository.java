package com.treehouse.module.bottle;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BottleWarmRepository extends JpaRepository<BottleWarm, Long> {
    /** 同一人是否温暖过 */
    boolean existsByBottleIdAndUserId(Long bottleId, Long userId);

    /** 我温暖的列表 */
    @Query("SELECT w.bottleId FROM BottleWarm w WHERE w.userId = :userId ORDER BY w.createTime DESC")
    List<Long> findBottleIdsByUserId(@Param("userId") Long userId);

    /** 瓶子总温暖次数 */
    long countByBottleId(Long bottleId);

    /**
     * 批量查「当前用户在这批瓶子里温暖过哪些」——一次查询代替 N 次 exists，避免 N+1。
     */
    @Query("select w.bottleId from BottleWarm w where w.userId = :userId and w.bottleId in :bottleIds")
    java.util.List<Long> findBottleIdsByUserIdAndBottleIdIn(@Param("userId") Long userId,
                                                            @Param("bottleIds") java.util.Collection<Long> bottleIds);
}
