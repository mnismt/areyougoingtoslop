"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const server_1 = require("next/server");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const rate_limit_1 = require("../../../server/rate-limit");
const limiter = new rate_limit_1.MemoryRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxRequests: 5,
});
const getStoragePath = () => process.env.FEEDBACK_STORAGE_PATH ?? ".data/feedback.json";
const getClientIp = (request) => {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]?.trim();
    }
    return request.headers.get("x-real-ip") ?? undefined;
};
const loadEntries = async (storagePath) => {
    try {
        const raw = await node_fs_1.promises.readFile(storagePath, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const saveEntries = async (storagePath, entries) => {
    await node_fs_1.promises.mkdir(node_path_1.default.dirname(storagePath), { recursive: true });
    await node_fs_1.promises.writeFile(storagePath, JSON.stringify(entries, null, 2));
};
const POST = async (request) => {
    const now = new Date();
    const ip = getClientIp(request);
    if (ip) {
        const limitResult = limiter.check(ip, now.getTime());
        if (!limitResult.allowed) {
            return server_1.NextResponse.json({
                error: "rate_limited",
                message: "Too many feedback submissions. Try again later.",
            }, { status: 429 });
        }
    }
    const payload = await request.json().catch(() => null);
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!message || message.length < 5) {
        return server_1.NextResponse.json({ error: "invalid_payload", message: "Feedback is too short." }, { status: 400 });
    }
    if (message.length > 1000) {
        return server_1.NextResponse.json({ error: "invalid_payload", message: "Feedback is too long." }, { status: 400 });
    }
    const storagePath = getStoragePath();
    const entries = await loadEntries(storagePath);
    entries.push({
        message,
        received_at: now.toISOString(),
        ip,
    });
    await saveEntries(storagePath, entries.slice(-200));
    return server_1.NextResponse.json({ ok: true }, { status: 201 });
};
exports.POST = POST;
