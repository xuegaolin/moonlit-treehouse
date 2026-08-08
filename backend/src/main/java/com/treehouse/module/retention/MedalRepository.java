package com.treehouse.module.retention;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedalRepository extends JpaRepository<Medal, Long> {

    List<Medal> findByUserIdOrderByAchievedAtDesc(Long userId);

    boolean existsByUserIdAndMedalCode(Long userId, String medalCode);
}
