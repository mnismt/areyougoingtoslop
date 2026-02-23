import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { POST } from "./route";

const createTempPath = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "feedback-"));
  return path.join(dir, "feedback.json");
};

describe("feedback api", () => {
  it("accepts feedback submissions", async () => {
    const storagePath = await createTempPath();
    process.env.FEEDBACK_STORAGE_PATH = storagePath;

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Great roast, keep going." }),
      }),
    );

    assert.equal(response.status, 201);
    const raw = await readFile(storagePath, "utf-8");
    const entries = JSON.parse(raw) as Array<{ message: string }>;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].message, "Great roast, keep going.");
  });

  it("rejects short feedback", async () => {
    const storagePath = await createTempPath();
    process.env.FEEDBACK_STORAGE_PATH = storagePath;

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hey" }),
      }),
    );

    assert.equal(response.status, 400);
  });
});
