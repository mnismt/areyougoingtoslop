"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScoreP95 = exports.recordScoreTiming = void 0;
const samples = [];
const MAX_SAMPLES = 200;
const recordScoreTiming = (durationMs) => {
    samples.push(durationMs);
    if (samples.length > MAX_SAMPLES) {
        samples.shift();
    }
};
exports.recordScoreTiming = recordScoreTiming;
const getScoreP95 = () => {
    if (samples.length === 0) {
        return null;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
};
exports.getScoreP95 = getScoreP95;
