import { promises as fs } from "node:fs";
import path from "node:path";
import type { LeaderboardEntry } from "./types";

export type LeaderboardStoreOptions = {
  storagePath?: string;
  now?: Date;
  maxEntries?: number;
  minUpdateIntervalMinutes?: number;
  confidenceFloor?: "low" | "medium" | "high";
  limit?: number;
};

type LeaderboardState = {
  entries: LeaderboardEntry[];
};

const DEFAULT_STORAGE_PATH =
  process.env.LEADERBOARD_STORAGE_PATH ?? ".data/leaderboard.json";
const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_MIN_UPDATE_INTERVAL_MINUTES = 10;
const DEFAULT_LIMIT = 50;
const DEFAULT_CONFIDENCE_FLOOR: LeaderboardStoreOptions["confidenceFloor"] =
  "medium";

const confidenceRank: Record<NonNullable<LeaderboardStoreOptions["confidenceFloor"]>, number> =
  {
    low: 0,
    medium: 1,
    high: 2,
  };

const resolveStoragePath = (storagePath?: string) =>
  path.resolve(storagePath ?? DEFAULT_STORAGE_PATH);

let writeLock = Promise.resolve();

const withLock = async <T>(fn: () => Promise<T>): Promise<T> => {
  let release: () => void;
  const acquired = new Promise<void>((resolve) => { release = resolve; });
  const previous = writeLock;
  writeLock = acquired;
  await previous;
  try {
    return await fn();
  } finally {
    release!();
  }
};

const loadState = async (
  storagePath: string,
): Promise<LeaderboardState> => {
  try {
    const raw = await fs.readFile(storagePath, "utf-8");
    const parsed = JSON.parse(raw) as LeaderboardState;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return parsed;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return { entries: [] };
    }
    console.warn("Failed to load leaderboard state:", err);
    throw err;
  }
};

const saveState = async (storagePath: string, state: LeaderboardState) => {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(state, null, 2));
};

const sortEntries = (entries: LeaderboardEntry[]) =>
  entries.sort((a, b) => {
    if (a.slop_score !== b.slop_score) {
      return b.slop_score - a.slop_score;
    }
    const timeDiff =
      new Date(b.last_scored_at).getTime() -
      new Date(a.last_scored_at).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.username.localeCompare(b.username);
  });

export const upsertLeaderboardEntry = async (
  entry: LeaderboardEntry,
  options: LeaderboardStoreOptions = {},
): Promise<LeaderboardEntry | null> => {
  return withLock(async () => {
    const storagePath = resolveStoragePath(options.storagePath);
    const now = options.now ?? new Date();
    const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    const minInterval =
      options.minUpdateIntervalMinutes ?? DEFAULT_MIN_UPDATE_INTERVAL_MINUTES;

    const state = await loadState(storagePath);
    const normalized = entry.username.toLowerCase();
    const existingIndex = state.entries.findIndex(
      (item) => item.username.toLowerCase() === normalized,
    );

    if (existingIndex >= 0) {
      const existing = state.entries[existingIndex];
      const last = new Date(existing.last_scored_at);
      const diffMinutes = (now.getTime() - last.getTime()) / (1000 * 60);
      if (!Number.isNaN(diffMinutes) && diffMinutes < minInterval) {
        return null;
      }
    }

    const updatedEntry: LeaderboardEntry = {
      ...entry,
      last_scored_at: now.toISOString(),
    };

    if (existingIndex >= 0) {
      state.entries[existingIndex] = updatedEntry;
    } else {
      state.entries.push(updatedEntry);
    }

    const trimmed = sortEntries(state.entries).slice(0, maxEntries);
    await saveState(storagePath, { entries: trimmed });
    return updatedEntry;
  });
};

export const getLeaderboard = async (options: LeaderboardStoreOptions = {}) => {
  const storagePath = resolveStoragePath(options.storagePath);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const confidenceFloor = options.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
  const state = await loadState(storagePath);
  const filtered = sortEntries([...state.entries]).filter(
    (entry) =>
      confidenceRank[entry.confidence] >= confidenceRank[confidenceFloor],
  );

  return {
    entries: filtered.slice(0, limit),
    updated_at:
      filtered[0]?.last_scored_at ??
      state.entries[0]?.last_scored_at ??
      null,
  };
};
