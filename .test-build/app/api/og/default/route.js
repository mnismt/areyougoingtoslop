"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = exports.runtime = void 0;
const og_1 = require("next/og");
const og_card_1 = require("../og-card");
exports.runtime = "edge";
const GET = async () => {
    return new og_1.ImageResponse((0, og_card_1.renderOgCard)({
        title: "Playful slop score",
        subtitle: "We scan public GitHub activity and deliver a fun roast.",
    }), {
        width: 1200,
        height: 630,
    });
};
exports.GET = GET;
