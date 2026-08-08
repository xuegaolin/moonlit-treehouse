package com.treehouse.module.feature;

import com.treehouse.common.BizException;
import com.treehouse.common.ResultCode;
import com.treehouse.module.feature.dto.FeatureCreateRequest;
import com.treehouse.module.feature.dto.FeatureVO;
import com.treehouse.module.feature.entity.FeatureRequest;
import com.treehouse.module.feature.entity.FeatureVote;
import com.treehouse.module.feature.repository.FeatureRequestRepository;
import com.treehouse.module.feature.repository.FeatureVoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 功能投票服务
 *
 * <p>并发安全（沿用 7/31 硬规则）：</p>
 * <ul>
 *   <li>投票：UNIQUE(user_id, feature_id) 兜底 + catch + 重读</li>
 *   <li>vote_count 累加：原子 SQL（UPDATE...SET field = field + 1），不用 SELECT + UPDATE</li>
 *   <li>取消票：同事务先 DELETE vote 再 -1 vote_count</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeatureService {

    private final FeatureRequestRepository requestRepository;
    private final FeatureVoteRepository voteRepository;

    /** 列出全站功能建议（按票数降序） */
    @Transactional(readOnly = true)
    public List<FeatureVO> list(int page, int size, Long currentUserId) {
        int safeSize = Math.max(1, Math.min(50, size));
        int safePage = Math.max(0, page);
        Page<FeatureRequest> p = requestRepository
                .findAllByOrderByVoteCountDescCreateTimeDesc(PageRequest.of(safePage, safeSize));
        // 一次性查当前用户所有投票，O(N) 转 Set
        Set<Long> votedIds = new HashSet<>();
        if (currentUserId != null) {
            for (FeatureVote v : voteRepository.findByUserId(currentUserId)) {
                votedIds.add(v.getFeatureId());
            }
        }
        List<FeatureVO> out = new ArrayList<>();
        for (FeatureRequest r : p) {
            out.add(FeatureVO.from(r,
                    votedIds.contains(r.getId()),
                    currentUserId != null && currentUserId.equals(r.getUserId())));
        }
        return out;
    }

    /** 我提的功能 */
    @Transactional(readOnly = true)
    public List<FeatureVO> mine(Long userId, int page, int size) {
        int safeSize = Math.max(1, Math.min(50, size));
        int safePage = Math.max(0, page);
        Page<FeatureRequest> p = requestRepository
                .findByUserIdOrderByCreateTimeDesc(userId, PageRequest.of(safePage, safeSize));
        Set<Long> votedIds = new HashSet<>();
        for (FeatureVote v : voteRepository.findByUserId(userId)) {
            votedIds.add(v.getFeatureId());
        }
        List<FeatureVO> out = new ArrayList<>();
        for (FeatureRequest r : p) {
            out.add(FeatureVO.from(r, votedIds.contains(r.getId()), true));
        }
        return out;
    }

    @Transactional(rollbackFor = Exception.class)
    public FeatureVO create(Long userId, FeatureCreateRequest req) {
        FeatureRequest r = new FeatureRequest();
        r.setUserId(userId);
        r.setTitle(req.getTitle().trim());
        r.setDescription(req.getDescription().trim());
        r.setStatus("OPEN");
        r.setVoteCount(0);
        r = requestRepository.save(r);
        log.info("功能建议提交：userId={}, id={}, title={}", userId, r.getId(), r.getTitle());
        return FeatureVO.from(r, false, true);
    }

    /**
     * 投票（toggle 行为：已投则取消，未投则投上）
     */
    @Transactional(rollbackFor = Exception.class)
    public FeatureVO vote(Long userId, Long featureId) {
        FeatureRequest r = requestRepository.findById(featureId)
                .orElseThrow(() -> new BizException(ResultCode.NOT_FOUND));
        if (r.getStatus() != null && "DONE".equals(r.getStatus())) {
            throw new BizException(40000, "该功能已上线，无需再投");
        }

        // 查是否已投
        java.util.Optional<FeatureVote> existing = voteRepository.findByUserIdAndFeatureId(userId, featureId);
        boolean nowVoted;
        if (existing.isPresent()) {
            // 取消票
            voteRepository.delete(existing.get());
            requestRepository.bumpVoteCount(featureId, -1);
            nowVoted = false;
        } else {
            // 投上
            FeatureVote v = new FeatureVote();
            v.setUserId(userId);
            v.setFeatureId(featureId);
            try {
                voteRepository.saveAndFlush(v);
            } catch (DataIntegrityViolationException e) {
                // 并发：另一个请求先投了，忽略
                log.warn("投票撞唯一约束：userId={}, featureId={}", userId, featureId);
            }
            requestRepository.bumpVoteCount(featureId, 1);
            nowVoted = true;
        }
        // 重读拿最新
        r = requestRepository.findById(featureId).orElseThrow(new java.util.function.Supplier<BizException>() {
            @Override
            public BizException get() {
                return new BizException(ResultCode.NOT_FOUND);
            }
        });
        return FeatureVO.from(r, nowVoted, userId.equals(r.getUserId()));
    }
}
