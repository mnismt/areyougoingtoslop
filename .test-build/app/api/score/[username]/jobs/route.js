"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const server_1 = require("next/server");
const score_jobs_1 = require("../../../../../server/api/score-jobs");
const POST = async (_request, { params }) => {
    const { username } = await params;
    const result = (0, score_jobs_1.createOrAttachScoreJob)(username);
    if (!result.ok) {
        return server_1.NextResponse.json({
            error: result.error.code,
            message: result.error.message,
        }, {
            status: 400,
        });
    }
    return server_1.NextResponse.json(result.snapshot, {
        status: result.snapshot.status === 'completed' ? 200 : 202,
        headers: {
            'cache-control': 'no-store',
        },
    });
};
exports.POST = POST;
