"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const score_jobs_1 = require("../../../../../server/api/score-jobs");
const route_1 = require("./route");
(0, node_test_1.describe)('score job by id route', () => {
    (0, node_test_1.it)('returns job_not_found when no snapshot exists', async () => {
        (0, score_jobs_1.clearScoreJobs)();
        const response = await (0, route_1.GET)(new Request('http://localhost'), {
            params: Promise.resolve({ jobId: 'missing-job-id' }),
        });
        strict_1.default.equal(response.status, 404);
        const body = await response.json();
        strict_1.default.equal(body.error, 'job_not_found');
    });
});
