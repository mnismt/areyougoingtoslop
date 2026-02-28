"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderOgCard = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const colors_1 = require("@/lib/colors");
const scoreColor = (score) => {
    if (score <= 30)
        return colors_1.COLORS.slopGreen;
    if (score <= 70)
        return colors_1.COLORS.slopYellow;
    return colors_1.COLORS.slopRed;
};
const renderOgCard = ({ title, subtitle, score, tier, confidence, username, }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { style: {
            display: 'flex',
            height: '100%',
            width: '100%',
            background: `linear-gradient(135deg, ${colors_1.COLORS.background} 0%, #f5f5f4 50%, ${colors_1.COLORS.background} 100%)`,
            color: colors_1.COLORS.foreground,
            fontFamily: '"Inter","Helvetica Neue","Arial",sans-serif',
            padding: '56px',
            boxSizing: 'border-box',
        }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [(0, jsx_runtime_1.jsx)("p", { style: {
                                    fontSize: 18,
                                    color: colors_1.COLORS.muted,
                                    margin: 0,
                                    fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
                                }, children: "areyougoingslop" }), (0, jsx_runtime_1.jsx)("h1", { style: {
                                    fontSize: 54,
                                    margin: 0,
                                    lineHeight: 1.1,
                                    fontWeight: 700,
                                }, children: title }), (0, jsx_runtime_1.jsx)("p", { style: { fontSize: 22, margin: 0, color: colors_1.COLORS.muted }, children: subtitle })] }), username ? ((0, jsx_runtime_1.jsxs)("div", { style: {
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'center',
                            fontSize: 20,
                            color: colors_1.COLORS.muted,
                        }, children: ["@", username] })) : null] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                    width: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '16px',
                    borderRadius: '20px',
                    background: colors_1.COLORS.card,
                    border: `1px solid ${colors_1.COLORS.border}`,
                }, children: [(0, jsx_runtime_1.jsx)("p", { style: {
                            fontSize: 14,
                            color: colors_1.COLORS.muted,
                            margin: 0,
                            fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
                        }, children: "slop score" }), (0, jsx_runtime_1.jsx)("p", { style: {
                            fontSize: 72,
                            margin: 0,
                            color: score != null ? scoreColor(score) : colors_1.COLORS.primary,
                            fontWeight: 700,
                            fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
                        }, children: score ?? '--' }), (0, jsx_runtime_1.jsxs)("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            alignItems: 'center',
                            padding: '0 24px 24px',
                        }, children: [(0, jsx_runtime_1.jsx)("p", { style: {
                                    margin: 0,
                                    fontSize: 18,
                                    color: colors_1.COLORS.foreground,
                                    textAlign: 'center',
                                    fontWeight: 600,
                                }, children: tier ?? 'Playful heuristic' }), confidence ? ((0, jsx_runtime_1.jsxs)("p", { style: {
                                    margin: 0,
                                    fontSize: 14,
                                    color: colors_1.COLORS.muted,
                                    fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
                                }, children: [confidence, " confidence"] })) : null] })] })] }));
};
exports.renderOgCard = renderOgCard;
