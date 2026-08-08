package com.treehouse.module.feature.repository;

import com.treehouse.module.feature.entity.FeatureVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FeatureVoteRepository extends JpaRepository<FeatureVote, Long> {

    Optional<FeatureVote> findByUserIdAndFeatureId(Long userId, Long featureId);

    List<FeatureVote> findByUserId(Long userId);
}
