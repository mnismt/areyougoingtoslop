"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SCORING_CONFIG = void 0;
exports.DEFAULT_SCORING_CONFIG = {
    weights: {
        ai_keywords: 0.35,
        prompt_crumbs: 0.2,
        velocity_volume: 0.15,
        apathy_ratio: 0.15,
        churn: 0.15,
    },
    recencyBuckets: [
        { days: 30, weight: 1.0 },
        { days: 90, weight: 0.6 },
        { days: 180, weight: 0.3 },
    ],
    thresholds: {
        largeChange: 250,
        churnAdditions: 350,
        churnDeletions: 350,
        velocitySpike: 800,
    },
};
