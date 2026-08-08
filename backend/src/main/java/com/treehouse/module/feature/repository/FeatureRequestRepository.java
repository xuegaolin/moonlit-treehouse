package com.treehouse.module.feature.repository;

import com.treehouse.module.feature.entity.FeatureRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FeatureRequestRepository extends JpaRepository<FeatureRequest, Long> {

    Page<FeatureRequest> findAllByOrderByVoteCountDescCreateTimeDesc(Pageable pageable);

    Page<FeatureRequest> findByUserIdOrderByCreateTimeDesc(Long userId, Pageable pageable);

    @Modifying
    @Query("UPDATE FeatureRequest f SET f.voteCount = f.voteCount + :delta WHERE f.id = :id")
    int bumpVoteCount(@Param("id") Long id, @Param("delta") int delta);
}
