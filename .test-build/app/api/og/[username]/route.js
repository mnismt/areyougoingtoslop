"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = exports.runtime = void 0;
const og_1 = require("next/og");
const score_1 = require("../../../../server/api/score");
const github_1 = require("../../../../server/github");
const og_card_1 = require("../og-card");
exports.runtime = 'edge';
const GET = async (_request, { params }) => {
    const { username } = await params;
    try {
        const score = await (0, score_1.scoreUser)(username);
        return new og_1.ImageResponse((0, og_card_1.renderOgCard)({
            title: score.tier,
            subtitle: 'Satirical heuristic. Roast the code, not the coder.',
            score: score.slop_score,
            tier: score.tier,
            confidence: score.confidence,
            username,
        }), {
            width: 1200,
            height: 630,
        });
    }
    catch (error) {
        const subtitle = error instanceof github_1.GitHubNotFoundError
            ? 'GitHub user not found.'
            : error instanceof github_1.GitHubRateLimitError
                ? 'Rate limited. Try again soon.'
                : 'Score unavailable right now.';
        return new og_1.ImageResponse((0, og_card_1.renderOgCard)({
            title: 'Score unavailable',
            subtitle,
            username,
        }), {
            width: 1200,
            height: 630,
        });
    }
};
exports.GET = GET;
