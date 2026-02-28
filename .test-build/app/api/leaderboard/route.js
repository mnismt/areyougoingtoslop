"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const server_1 = require("next/server");
const leaderboard_1 = require("../../../server/leaderboard");
const GET = async (request) => {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(limitParam, 1), 100)
        : undefined;
    const leaderboard = await (0, leaderboard_1.getLeaderboard)({ limit });
    return server_1.NextResponse.json({
        ...leaderboard,
        generated_at: new Date().toISOString(),
    });
};
exports.GET = GET;
