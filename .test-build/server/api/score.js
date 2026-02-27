"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreUser = void 0;
const github_1 = require("../github");
const scoring_1 = require("../scoring");
const scoreUser = async (username, options = {}) => {
    const effectiveNow = options.now ?? new Date();
    const events = await (0, github_1.fetchUserActivity)(username, {
        token: options.token,
        fetcher: options.fetcher,
        now: effectiveNow,
    });
    return (0, scoring_1.computeSlopScore)(events, undefined, effectiveNow);
};
exports.scoreUser = scoreUser;
