import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { MemoryRateLimiter } from "../../../server/rate-limit";

type FeedbackEntry = {
  message: string;
  received_at: string;
  ip?: string;
};

const limiter = new MemoryRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
});

const getStoragePath = () =>
  process.env.FEEDBACK_STORAGE_PATH ?? ".data/feedback.json";

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }
  return request.headers.get("x-real-ip") ?? undefined;
};

const loadEntries = async (storagePath: string): Promise<FeedbackEntry[]> => {
  try {
    const raw = await fs.readFile(storagePath, "utf-8");
    const parsed = JSON.parse(raw) as FeedbackEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveEntries = async (storagePath: string, entries: FeedbackEntry[]) => {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify(entries, null, 2));
};

export const POST = async (request: Request) => {
  const now = new Date();
  const ip = getClientIp(request);
  if (ip) {
    const limitResult = limiter.check(ip, now.getTime());
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Too many feedback submissions. Try again later.",
        },
        { status: 429 },
      );
    }
  }

  const payload = await request.json().catch(() => null);
  const message =
    typeof payload?.message === "string" ? payload.message.trim() : "";
  if (!message || message.length < 5) {
    return NextResponse.json(
      { error: "invalid_payload", message: "Feedback is too short." },
      { status: 400 },
    );
  }
  if (message.length > 1000) {
    return NextResponse.json(
      { error: "invalid_payload", message: "Feedback is too long." },
      { status: 400 },
    );
  }

  const storagePath = getStoragePath();
  const entries = await loadEntries(storagePath);
  entries.push({
    message,
    received_at: now.toISOString(),
    ip,
  });
  await saveEntries(storagePath, entries.slice(-200));

  return NextResponse.json({ ok: true }, { status: 201 });
};
