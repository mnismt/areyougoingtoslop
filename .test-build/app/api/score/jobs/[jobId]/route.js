"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const server_1 = require("next/server");
const score_jobs_1 = require("../../../../../server/api/score-jobs");
const GET = async (_request, { params }) => {
    const { jobId } = await params;
    const snapshot = (0, score_jobs_1.getScoreJob)(jobId);
    if (!snapshot) {
        return server_1.NextResponse.json({
            error: 'job_not_found',
            message: 'Score job not found.',
        }, { status: 404 });
    }
    return server_1.NextResponse.json(snapshot, {
        headers: {
            'cache-control': 'no-store',
        },
    });
};
exports.GET = GET;
