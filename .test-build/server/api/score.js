"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreUser = exports.scoreUserWithMetadata = void 0;
const github_1 = require("../github");
const scoring_1 = require("../scoring");
const toCoverage = (coverage) => ({
    commits_discovered: coverage.commitsDiscovered,
    commits_enriched: coverage.commitsEnriched,
    repos_scanned: coverage.reposScanned,
    repos_total: coverage.reposTotal,
    window_days: coverage.windowDays,
    is_partial: coverage.isPartial,
    sources_used: coverage.sourcesUsed,
});
const toLimits = (limits) => ({
    rate_limited: limits.rateLimited,
    events_pagination_limited: limits.eventsPaginationLimited,
});
const emitProgress = async (update, now, onProgress) => {
    if (!onProgress) {
        return;
    }
    const score = (0, scoring_1.computeSlopScore)(update.events, undefined, now);
    await onProgress({
        stage: update.stage,
        progress_percent: update.progressPercent,
        result: score,
        coverage: toCoverage(update.coverage),
        limits: toLimits(update.limits),
    });
};
const scoreUserWithMetadata = async (username, options = {}) => {
    const effectiveNow = options.now ?? new Date();
    const activity = await (0, github_1.fetchUserActivityWithMetadata)(username, {
        token: options.token,
        fetcher: options.fetcher,
        now: effectiveNow,
        onProgress: (progress) => emitProgress(progress, effectiveNow, options.onProgress),
    });
    const finalResult = (0, scoring_1.computeSlopScore)(activity.events, undefined, effectiveNow);
    return {
        result: finalResult,
        coverage: toCoverage(activity.coverage),
        limits: toLimits(activity.limits),
    };
};
exports.scoreUserWithMetadata = scoreUserWithMetadata;
const scoreUser = async (username, options = {}) => {
    if (!options.onProgress) {
        const effectiveNow = options.now ?? new Date();
        const events = await (0, github_1.fetchUserActivity)(username, {
            token: options.token,
            fetcher: options.fetcher,
            now: effectiveNow,
        });
        return (0, scoring_1.computeSlopScore)(events, undefined, effectiveNow);
    }
    const result = await (0, exports.scoreUserWithMetadata)(username, options);
    return result.result;
};
exports.scoreUser = scoreUser;
