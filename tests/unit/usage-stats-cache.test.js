import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// getUsageStats caches the merged rollup of past days and shares in-flight
// computations. These tests pin the behaviours that caching could break.

const DAY = 86400000;
const noon = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
const daysAgo = (n) => new Date(noon().getTime() - n * DAY).toISOString();
const dateKeyOf = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("getUsageStats caching", () => {
  let tempDir;
  let usage;
  let db;
  const originalDataDir = process.env.DATA_DIR;

  const save = (timestamp, extra = {}) => usage.saveRequestUsage({
    timestamp,
    provider: "openai",
    model: "gpt-4o",
    connectionId: "conn-1",
    apiKey: "sk-test-key-1",
    endpoint: "/v1/chat/completions",
    tokens: { prompt_tokens: 100, completion_tokens: 10 },
    ...extra,
  });

  // The adapter is a process-global singleton, so one DB serves the whole file;
  // each test starts from empty usage tables and a cold rollup cache.
  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-usage-cache-"));
    process.env.DATA_DIR = tempDir;
    vi.resetModules();
    usage = await import("@/lib/db/repos/usageRepo.js");
    db = await (await import("@/lib/db/driver.js")).getAdapter();
  });

  beforeEach(() => {
    db.run(`DELETE FROM usageDaily`);
    db.run(`DELETE FROM usageHistory`);
    usage.invalidateUsageStatsCache();
  });

  afterAll(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it("does not re-read past days on a warm refresh", async () => {
    for (let d = 1; d <= 5; d++) await save(daysAgo(d));
    await save(daysAgo(0));

    await usage.getUsageStats("all");
    // Count usageDaily rows actually loaded by the warm refresh: only today's.
    const realAll = db.all.bind(db);
    let dailyRowsRead = 0;
    const spy = vi.spyOn(db, "all").mockImplementation((sql, params) => {
      const rows = realAll(sql, params);
      if (/FROM usageDaily/.test(sql)) dailyRowsRead += rows.length;
      return rows;
    });
    const stats = await usage.getUsageStats("all");
    spy.mockRestore();
    expect(dailyRowsRead).toBe(1);
    expect(stats.totalRequests).toBe(6);
  });

  it("reflects new requests for today immediately", async () => {
    await save(daysAgo(3));
    const before = await usage.getUsageStats("all");
    await save(daysAgo(0));
    const after = await usage.getUsageStats("all");
    expect(after.totalRequests).toBe(before.totalRequests + 1);
  });

  it("a late write dated on a past day invalidates the cached rollup", async () => {
    await save(daysAgo(2));
    const before = await usage.getUsageStats("all");
    await save(daysAgo(2), { tokens: { prompt_tokens: 500, completion_tokens: 50 } });
    const after = await usage.getUsageStats("all");
    expect(after.totalRequests).toBe(before.totalRequests + 1);
    expect(after.totalPromptTokens).toBe(before.totalPromptTokens + 500);
  });

  it("keeps per-day byAccount rows when one account used different models on different days", async () => {
    // usageDaily.byAccount is keyed by connectionId only; the model shown is the
    // one that day ended on. Merging past days must not collapse these rows.
    await save(daysAgo(3), { model: "gpt-4o" });
    await save(daysAgo(2), { model: "gpt-4o-mini" });
    const stats = await usage.getUsageStats("all");
    const rows = Object.values(stats.byAccount).filter((r) => r.connectionId === "conn-1");
    expect(rows.map((r) => r.rawModel).sort()).toEqual(["gpt-4o", "gpt-4o-mini"]);
    expect(rows.every((r) => r.requests === 1)).toBe(true);
  });

  it("lastUsed of a merged past entry is its latest day", async () => {
    await save(daysAgo(10));
    await save(daysAgo(4));
    const stats = await usage.getUsageStats("60d");
    const model = stats.byModel["gpt-4o (openai)"];
    expect(model.requests).toBe(2);
    expect(model.lastUsed).toBe(dateKeyOf(daysAgo(4)));
  });

  it("period windows only include days inside the window", async () => {
    await save(daysAgo(20));
    await save(daysAgo(3));
    await save(daysAgo(0));
    expect((await usage.getUsageStats("7d")).totalRequests).toBe(2);
    expect((await usage.getUsageStats("30d")).totalRequests).toBe(3);
  });

  it("matches a cold recomputation after invalidation", async () => {
    for (let d = 0; d < 8; d++) {
      await save(daysAgo(d), { model: d % 2 ? "gpt-4o" : "gpt-4o-mini", connectionId: d % 3 ? "conn-1" : "conn-2" });
    }
    const warmFirst = await usage.getUsageStats("all");
    const warm = await usage.getUsageStats("all");
    usage.invalidateUsageStatsCache();
    const cold = await usage.getUsageStats("all");
    const strip = ({ last10Minutes, pending, activeRequests, errorProvider, ...rest }) => rest;
    expect(strip(warm)).toEqual(strip(cold));
    expect(strip(warmFirst)).toEqual(strip(cold));
  });

  it("concurrent callers for the same period share one computation", async () => {
    await save(daysAgo(1));
    const [a, b, c] = await Promise.all([
      usage.getUsageStats("all"),
      usage.getUsageStats("all"),
      usage.getUsageStats("all"),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    // A call after completion recomputes (fresh object), so freshness is unchanged.
    const d = await usage.getUsageStats("all");
    expect(d).not.toBe(a);
  });
});
