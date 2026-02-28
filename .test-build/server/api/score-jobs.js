"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearScoreJobs = exports.getScoreJob = exports.createOrAttachScoreJob = void 0;
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const cache_1 = require("../cache");
const github_1 = require("../github");
const leaderboard_1 = require("../leaderboard");
const metrics_1 = require("../perf/metrics");
const score_1 = require("./score");
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const JOB_RETENTION_MS = 30 * 60 * 1000;
const jobs = new Map();
const activeByUsername = new Map();
const emptyCoverage = {
    commits_discovered: 0,
    commits_enriched: 0,
    repos_scanned: 0,
    repos_total: 0,
    window_days: 180,
    is_partial: true,
    sources_used: [],
};
const emptyLimits = {
    rate_limited: false,
    events_pagination_limited: false,
};
const toSnapshot = (job) => ({
    job_id: job.jobId,
    username: job.username,
    status: job.status,
    stage: job.stage,
    progress_percent: job.progressPercent,
    result: job.result,
    coverage: job.coverage,
    limits: job.limits,
    error: job.error,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
});
const touch = (job) => {
    job.updatedAt = new Date().toISOString();
};
const cleanupJobs = () => {
    const cutoff = Date.now() - JOB_RETENTION_MS;
    for (const [jobId, job] of jobs) {
        const updatedAt = new Date(job.updatedAt).getTime();
        if (!Number.isNaN(updatedAt) && updatedAt < cutoff) {
            jobs.delete(jobId);
            const key = job.username.toLowerCase();
            if (activeByUsername.get(key) === jobId) {
                activeByUsername.delete(key);
            }
        }
    }
};
const mapError = (error) => {
    if (error instanceof github_1.GitHubNotFoundError) {
        return {
            code: 'not_found',
            message: 'GitHub user not found.',
        };
    }
    if (error instanceof github_1.GitHubRateLimitError) {
        return {
            code: 'rate_limited',
            message: 'GitHub API rate limit exceeded.',
            reset_at: error.resetAt,
        };
    }
    if (error instanceof github_1.GitHubValidationError) {
        return {
            code: 'invalid_username',
            message: error.message,
        };
    }
    return {
        code: 'server_error',
        message: 'Unable to compute score right now.',
    };
};
const runScoreJob = async (jobId) => {
    const job = jobs.get(jobId);
    if (!job) {
        return;
    }
    const start = node_perf_hooks_1.performance.now();
    job.status = 'running';
    job.stage = 'discovering';
    job.progressPercent = 5;
    touch(job);
    try {
        const result = await (0, score_1.scoreUserWithMetadata)(job.username, {
            onProgress: (progress) => {
                job.status = 'running';
                job.stage = progress.stage;
                job.progressPercent = progress.progress_percent;
                job.result = progress.result;
                job.coverage = progress.coverage;
                job.limits = progress.limits;
                job.error = null;
                touch(job);
            },
        });
        job.status = 'completed';
        job.stage = 'finalizing';
        job.progressPercent = 100;
        job.result = result.result;
        job.coverage = result.coverage;
        job.limits = result.limits;
        job.error = null;
        touch(job);
        const now = new Date();
        (0, cache_1.setCachedScore)(job.username, result.result, now, DEFAULT_CACHE_TTL_MS);
        await (0, leaderboard_1.upsertLeaderboardEntry)({
            username: job.username,
            slop_score: result.result.slop_score,
            tier: result.result.tier,
            confidence: result.result.confidence,
            last_scored_at: now.toISOString(),
        });
        const durationMs = node_perf_hooks_1.performance.now() - start;
        (0, metrics_1.recordScoreTiming)(durationMs);
        const p95 = (0, metrics_1.getScoreP95)();
        console.info('score_request', {
            username: job.username,
            duration_ms: Math.round(durationMs),
            p95_ms: p95 ? Math.round(p95) : null,
            source: 'score_job',
        });
    }
    catch (error) {
        job.status = 'failed';
        job.stage = 'finalizing';
        job.error = mapError(error);
        job.progressPercent = 100;
        touch(job);
    }
    finally {
        const key = job.username.toLowerCase();
        if (activeByUsername.get(key) === jobId) {
            activeByUsername.delete(key);
        }
    }
};
const createOrAttachScoreJob = (usernameRaw) => {
    cleanupJobs();
    const username = usernameRaw.trim();
    if (!(0, github_1.isValidGitHubUsername)(username)) {
        return {
            ok: false,
            error: {
                code: 'invalid_username',
                message: 'Invalid GitHub username.',
            },
        };
    }
    const existingJobId = activeByUsername.get(username.toLowerCase());
    if (existingJobId) {
        const existingJob = jobs.get(existingJobId);
        if (existingJob && existingJob.status !== 'failed') {
            return {
                ok: true,
                snapshot: toSnapshot(existingJob),
            };
        }
    }
    const now = new Date();
    const cached = (0, cache_1.getCachedScore)(username, now);
    if (cached) {
        const jobId = (0, node_crypto_1.randomUUID)();
        const createdAt = now.toISOString();
        const job = {
            jobId,
            username,
            status: 'completed',
            stage: 'finalizing',
            progressPercent: 100,
            result: cached,
            coverage: {
                ...emptyCoverage,
                commits_discovered: cached.analyzed_commits.length,
                commits_enriched: cached.analyzed_commits.filter((commit) => commit.additions !== undefined || commit.deletions !== undefined).length,
                is_partial: false,
            },
            limits: emptyLimits,
            error: null,
            createdAt,
            updatedAt: createdAt,
        };
        jobs.set(jobId, job);
        return {
            ok: true,
            snapshot: toSnapshot(job),
        };
    }
    const createdAt = now.toISOString();
    const jobId = (0, node_crypto_1.randomUUID)();
    const job = {
        jobId,
        username,
        status: 'queued',
        stage: 'queued',
        progressPercent: 0,
        result: null,
        coverage: emptyCoverage,
        limits: emptyLimits,
        error: null,
        createdAt,
        updatedAt: createdAt,
    };
    jobs.set(jobId, job);
    activeByUsername.set(username.toLowerCase(), jobId);
    void runScoreJob(jobId);
    return {
        ok: true,
        snapshot: toSnapshot(job),
    };
};
exports.createOrAttachScoreJob = createOrAttachScoreJob;
const getScoreJob = (jobId) => {
    cleanupJobs();
    const job = jobs.get(jobId);
    if (!job) {
        return null;
    }
    return toSnapshot(job);
};
exports.getScoreJob = getScoreJob;
const clearScoreJobs = () => {
    jobs.clear();
    activeByUsername.clear();
};
exports.clearScoreJobs = clearScoreJobs;
