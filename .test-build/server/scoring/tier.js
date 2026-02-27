"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapScoreToTier = void 0;
const mapScoreToTier = (score) => {
    if (score <= 10) {
        return "The Artisanal Masochist";
    }
    if (score <= 30) {
        return "The Tab-Key Athlete";
    }
    if (score <= 60) {
        return "The LLM Diplomat";
    }
    if (score <= 85) {
        return "The Agent Supervisor";
    }
    return "The Unsupervised Slop Machine";
};
exports.mapScoreToTier = mapScoreToTier;
