import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Settings cache ─────────────────────────────────────────────────────────
describe("settings cache", () => {
  let tempDir;
  const originalDataDir = process.env.DATA_DIR;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-settings-cache-"));
    process.env.DATA_DIR = tempDir;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it("repeated getSettings reads hit the DB once", async () => {
    const driver = await import("@/lib/db/driver.js");
    const repo = await import("@/lib/db/repos/settingsRepo.js");
    const db = await driver.getAdapter();
    const spy = vi.spyOn(db, "get");

    const a = await repo.getSettings();
    const b = await repo.getSettings();
    const c = await repo.getSettings();

    const settingsReads = spy.mock.calls.filter(([sql]) => /FROM settings/.test(sql));
    expect(settingsReads.length).toBe(1);
    // Each call gets its own merged object so callers can't poison each other.
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).toEqual(b);
  });

  it("updateSettings is visible on the next getSettings without waiting for TTL", async () => {
    const repo = await import("@/lib/db/repos/settingsRepo.js");
    await repo.getSettings();
    await repo.updateSettings({ requireApiKey: true, fallbackStrategy: "round-robin" });
    const s = await repo.getSettings();
    expect(s.requireApiKey).toBe(true);
    expect(s.fallbackStrategy).toBe("round-robin");
  });

  it("invalidateSettingsCache forces a fresh read", async () => {
    const driver = await import("@/lib/db/driver.js");
    const repo = await import("@/lib/db/repos/settingsRepo.js");
    const db = await driver.getAdapter();
    await repo.getSettings();
    // Write behind the cache's back (simulates importDb / another process)
    db.run(`INSERT INTO settings(id, data) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`, [JSON.stringify({ cloudEnabled: true })]);
    expect((await repo.getSettings()).cloudEnabled).toBe(false); // still cached
    repo.invalidateSettingsCache();
    expect((await repo.getSettings()).cloudEnabled).toBe(true);
  });

  it("importDb invalidates the cache", async () => {
    const dbMod = await import("@/lib/db/index.js");
    await dbMod.getSettings();
    await dbMod.importDb({ settings: { cloudEnabled: true } });
    expect((await dbMod.getSettings()).cloudEnabled).toBe(true);
  });
});

// ─── Per-provider selection lock ────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  updateProviderConnection: vi.fn(),
  getSettings: vi.fn(),
  getProxyPools: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  updateProviderConnection: mocks.updateProviderConnection,
  getSettings: mocks.getSettings,
  getProxyPools: mocks.getProxyPools,
  validateApiKey: vi.fn(),
}));

vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig,
  pickProxyPoolId: vi.fn(),
}));

vi.mock("@/sse/utils/logger.js", () => ({
  info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), maskKey: vi.fn(() => "masked"),
}));

describe("getProviderCredentials selection lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ fallbackStrategy: "fill-first", providerStrategies: {} });
    mocks.resolveConnectionProxyConfig.mockResolvedValue({});
    mocks.updateProviderConnection.mockResolvedValue({});
  });

  const conn = (id, provider, extra = {}) => ({ id, provider, isActive: true, priority: 1, providerSpecificData: {}, ...extra });

  it("requests for different providers do not queue behind each other", async () => {
    const { getProviderCredentials } = await import("@/sse/services/auth.js");
    let releaseOpenai;
    const openaiGate = new Promise((r) => { releaseOpenai = r; });
    mocks.getProviderConnections.mockImplementation(async ({ provider }) => {
      if (provider === "openai") { await openaiGate; return [conn("o1", "openai")]; }
      return [conn("c1", "claude")];
    });

    const slow = getProviderCredentials("openai", null, "gpt-4");
    const fast = getProviderCredentials("claude", null, "claude-3");

    // claude resolves while openai is still blocked inside its own lock
    const fastResult = await Promise.race([fast, new Promise((r) => setTimeout(() => r("timeout"), 200))]);
    expect(fastResult).not.toBe("timeout");
    expect(fastResult.connectionId).toBe("c1");

    releaseOpenai();
    expect((await slow).connectionId).toBe("o1");
  });

  it("round-robin bookkeeping for the same provider is serialized", async () => {
    mocks.getSettings.mockResolvedValue({ fallbackStrategy: "round-robin", stickyRoundRobinLimit: 1, providerStrategies: {} });
    const { getProviderCredentials } = await import("@/sse/services/auth.js");
    const order = [];
    mocks.getProviderConnections.mockImplementation(async () => {
      order.push("read");
      return [conn("a", "openai", { lastUsedAt: null }), conn("b", "openai", { lastUsedAt: null })];
    });
    mocks.updateProviderConnection.mockImplementation(async () => { order.push("write"); await new Promise((r) => setTimeout(r, 5)); });

    await Promise.all([
      getProviderCredentials("openai", null, "gpt-4"),
      getProviderCredentials("openai", null, "gpt-4"),
    ]);
    // read/write pairs never interleave: read,write,read,write
    expect(order).toEqual(["read", "write", "read", "write"]);
  });

  it("returns allRateLimited shape when every account is model-locked", async () => {
    const { getProviderCredentials } = await import("@/sse/services/auth.js");
    const future = new Date(Date.now() + 60_000).toISOString();
    mocks.getProviderConnections.mockResolvedValue([conn("a", "openai", { "modelLock_gpt-4": future, lastError: "429" })]);
    const res = await getProviderCredentials("openai", null, "gpt-4");
    expect(res.allRateLimited).toBe(true);
    expect(res.retryAfter).toBe(future);
    expect(res.lastError).toBe("429");
  });
});
