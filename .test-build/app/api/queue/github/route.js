"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = exports.revalidate = exports.dynamic = void 0;
const server_1 = require("next/server");
const github_queue_observer_1 = require("../../../../server/queue/github-queue-observer");
exports.dynamic = 'force-dynamic';
exports.revalidate = 0;
const GET = async () => {
    const snapshot = await (0, github_queue_observer_1.getGitHubQueueSnapshot)();
    return server_1.NextResponse.json(snapshot, {
        headers: {
            'cache-control': 'no-store',
        },
    });
};
exports.GET = GET;
