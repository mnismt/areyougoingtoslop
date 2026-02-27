"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const engine_1 = require("./engine");
const tier_1 = require("./tier");
(0, node_test_1.describe)("computeSlopScore", () => {
    (0, node_test_1.it)("applies recency weighting and produces deterministic score", () => {
        const now = new Date("2026-02-23T00:00:00.000Z");
        const events = [
            {
                id: "a",
                type: "commit",
                repo: "octo/repo",
                sha: "a",
                message: "feat: add copilot support",
                occurredAt: "2026-02-20T00:00:00.000Z",
            },
            {
                id: "b",
                type: "commit",
                repo: "octo/repo",
                sha: "b",
                message: "refactor: cleanup",
                occurredAt: "2026-02-20T00:00:00.000Z",
            },
            {
                id: "c",
                type: "commit",
                repo: "octo/repo",
                sha: "c",
                message: "docs: update by chatgpt",
                occurredAt: "2025-10-20T00:00:00.000Z",
            },
        ];
        const result = (0, engine_1.computeSlopScore)(events, undefined, now);
        strict_1.default.equal(result.slop_score, 20);
        strict_1.default.equal(result.confidence, "low");
    });
});
(0, node_test_1.describe)("mapScoreToTier", () => {
    (0, node_test_1.it)("maps score to tier boundaries", () => {
        strict_1.default.equal((0, tier_1.mapScoreToTier)(5), "The Artisanal Masochist");
        strict_1.default.equal((0, tier_1.mapScoreToTier)(25), "The Tab-Key Athlete");
        strict_1.default.equal((0, tier_1.mapScoreToTier)(45), "The LLM Diplomat");
        strict_1.default.equal((0, tier_1.mapScoreToTier)(70), "The Agent Supervisor");
        strict_1.default.equal((0, tier_1.mapScoreToTier)(99), "The Unsupervised Slop Machine");
    });
});
