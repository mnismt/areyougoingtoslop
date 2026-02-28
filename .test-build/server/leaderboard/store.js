"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaderboard = exports.upsertLeaderboardEntry = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_STORAGE_PATH = process.env.LEADERBOARD_STORAGE_PATH ?? '.data/leaderboard.json';
const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MIN_UPDATE_INTERVAL_MINUTES = 10;
const DEFAULT_LIMIT = 50;
const DEFAULT_CONFIDENCE_FLOOR = 'medium';
const confidenceRank = {
    low: 0,
    medium: 1,
    high: 2,
};
const resolveStoragePath = (storagePath) => node_path_1.default.resolve(storagePath ?? DEFAULT_STORAGE_PATH);
let writeLock = Promise.resolve();
const withLock = async (fn) => {
    let release;
    const acquired = new Promise((resolve) => {
        release = resolve;
    });
    const previous = writeLock;
    writeLock = acquired;
    await previous;
    try {
        return await fn();
    }
    finally {
        release();
    }
};
const loadState = async (storagePath) => {
    try {
        const raw = await node_fs_1.promises.readFile(storagePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.entries)) {
            return { entries: [] };
        }
        return parsed;
    }
    catch (err) {
        if (err instanceof Error &&
            'code' in err &&
            err.code === 'ENOENT') {
            return { entries: [] };
        }
        console.warn('Failed to load leaderboard state:', err);
        throw err;
    }
};
const saveState = async (storagePath, state) => {
    await node_fs_1.promises.mkdir(node_path_1.default.dirname(storagePath), { recursive: true });
    await node_fs_1.promises.writeFile(storagePath, JSON.stringify(state, null, 2));
};
const sortEntries = (entries) => entries.sort((a, b) => {
    if (a.slop_score !== b.slop_score) {
        return b.slop_score - a.slop_score;
    }
    const timeDiff = new Date(b.last_scored_at).getTime() -
        new Date(a.last_scored_at).getTime();
    if (timeDiff !== 0) {
        return timeDiff;
    }
    return a.username.localeCompare(b.username);
});
const upsertLeaderboardEntry = async (entry, options = {}) => {
    return withLock(async () => {
        const storagePath = resolveStoragePath(options.storagePath);
        const now = options.now ?? new Date();
        const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
        const minInterval = options.minUpdateIntervalMinutes ?? DEFAULT_MIN_UPDATE_INTERVAL_MINUTES;
        const state = await loadState(storagePath);
        const normalized = entry.username.toLowerCase();
        const existingIndex = state.entries.findIndex((item) => item.username.toLowerCase() === normalized);
        if (existingIndex >= 0) {
            const existing = state.entries[existingIndex];
            const last = new Date(existing.last_scored_at);
            const diffMinutes = (now.getTime() - last.getTime()) / (1000 * 60);
            if (!Number.isNaN(diffMinutes) && diffMinutes < minInterval) {
                return null;
            }
        }
        const updatedEntry = {
            ...entry,
            last_scored_at: now.toISOString(),
        };
        if (existingIndex >= 0) {
            state.entries[existingIndex] = updatedEntry;
        }
        else {
            state.entries.push(updatedEntry);
        }
        const trimmed = sortEntries(state.entries).slice(0, maxEntries);
        await saveState(storagePath, { entries: trimmed });
        return updatedEntry;
    });
};
exports.upsertLeaderboardEntry = upsertLeaderboardEntry;
const getLeaderboard = async (options = {}) => {
    const storagePath = resolveStoragePath(options.storagePath);
    const limit = options.limit ?? DEFAULT_LIMIT;
    const confidenceFloor = options.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
    const state = await loadState(storagePath);
    const filtered = sortEntries([...state.entries]).filter((entry) => confidenceRank[entry.confidence] >= confidenceRank[confidenceFloor]);
    return {
        entries: filtered.slice(0, limit),
        updated_at: filtered[0]?.last_scored_at ?? state.entries[0]?.last_scored_at ?? null,
    };
};
exports.getLeaderboard = getLeaderboard;
