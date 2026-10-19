import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getCombos: vi.fn(async () => []),
  getCustomModels: vi.fn(async () => []),
  getModelAliases: vi.fn(async () => ({})),
}));

vi.mock("@/lib/localDb", () => db);
vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: vi.fn(async () => ({})),
}));

const { buildModelsList } = await import("../../src/app/api/v1/models/route.js");

const findGpt55 = (models) => models.find((m) => m.id.endsWith("/gpt-5.5") && m.owned_by !== "combo");

describe("/v1/models display name", () => {
  it("emits the registry name on the connected-provider path", async () => {
    db.getProviderConnections.mockResolvedValue([{
      id: 1,
      provider: "openai",
      isActive: true,
      providerSpecificData: { enabledModels: ["gpt-5.5"] },
    }]);
    const model = findGpt55(await buildModelsList(["llm"]));
    expect(model).toMatchObject({ name: "GPT-5.5" });
  });

  it("emits the registry name on the static fallback path", async () => {
    db.getProviderConnections.mockResolvedValue([]);
    const model = findGpt55(await buildModelsList(["llm"]));
    expect(model).toMatchObject({ name: "GPT-5.5" });
  });

  it("prefers a custom model's own name over the registry", async () => {
    db.getProviderConnections.mockResolvedValue([{
      id: 1,
      provider: "openai",
      isActive: true,
      providerSpecificData: { enabledModels: ["gpt-5.5"] },
    }]);
    db.getCustomModels.mockResolvedValueOnce([
      { providerAlias: "openai", id: "gpt-5.5", type: "llm", name: "My GPT" },
    ]);
    const model = findGpt55(await buildModelsList(["llm"]));
    expect(model).toMatchObject({ name: "My GPT" });
  });

  it("keeps upstream display names for compatible providers with no static catalog", async () => {
    db.getProviderConnections.mockResolvedValue([{
      id: 1,
      provider: "anthropic-compatible-abc",
      isActive: true,
      apiKey: "k",
      providerSpecificData: { baseUrl: "https://example.test/v1", prefix: "cc" },
    }]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: "claude-haiku-4-5-20251001", display_name: "Claude Haiku 4.5", type: "model" },
        { id: "cc/claude-opus-5-5", display_name: "Claude Opus 5.5", type: "model" },
        { id: "bare-model", type: "model" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    try {
      const models = await buildModelsList(["llm"]);
      const byId = Object.fromEntries(models.map((m) => [m.id, m]));
      expect(byId["cc/claude-haiku-4-5-20251001"]).toMatchObject({ name: "Claude Haiku 4.5" });
      // alias-prefixed upstream id still maps its name onto the bare emitted id
      expect(byId["cc/claude-opus-5-5"]).toMatchObject({ name: "Claude Opus 5.5" });
      expect(byId["cc/bare-model"]).toBeDefined();
      expect(byId["cc/bare-model"].name).toBeUndefined();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("resolves kiro dash/dot id variants through the registry", async () => {
    db.getProviderConnections.mockResolvedValue([{
      id: 1,
      provider: "kiro",
      isActive: true,
      providerSpecificData: { enabledModels: ["claude-opus-5-5"] },
    }]);
    const models = await buildModelsList(["llm"]);
    const model = models.find((m) => m.id.endsWith("/claude-opus-5-5") && m.owned_by !== "combo");
    expect(model).toMatchObject({ name: "Claude Opus 5.5" });
  });

  it("names web search pseudo-models after the provider", async () => {
    db.getProviderConnections.mockResolvedValue([{
      id: 1,
      provider: "brave-search",
      isActive: true,
      providerSpecificData: {},
    }]);
    const models = await buildModelsList(["webSearch", "webFetch"]);
    const search = models.find((m) => m.kind === "webSearch");
    expect(search).toMatchObject({ name: "Brave Search" });
  });

  it("resolves name and kind for vendor-prefixed registry ids", async () => {
    db.getProviderConnections.mockResolvedValue([{
      id: 1,
      provider: "nvidia",
      isActive: true,
      providerSpecificData: {},
    }]);
    const llm = await buildModelsList(["llm"]);
    const nemotron = llm.find((m) => m.id === "nvidia/nemotron-3-ultra-550b-a55b");
    expect(nemotron).toMatchObject({ name: "Nemotron 3 Ultra" });
    // registry marks parakeet as stt: once the prefixed id resolves, it must leave the LLM list
    expect(llm.find((m) => m.id === "nvidia/parakeet-ctc-1.1b-asr")).toBeUndefined();
  });

  describe("vendor", () => {
    it("is the connection's provider id, not the alias", async () => {
      db.getProviderConnections.mockResolvedValue([{
        id: 1, provider: "claude", isActive: true, providerSpecificData: { prefix: "cc" },
      }]);
      const models = await buildModelsList(["llm"]);
      const model = models.find((m) => m.id === "cc/claude-fable-5");
      expect(model).toMatchObject({ owned_by: "cc", vendor: "claude" });
    });

    it("prefers a user-declared vendor on a custom model", async () => {
      db.getProviderConnections.mockResolvedValue([{
        id: 1, provider: "openai", isActive: true, providerSpecificData: { enabledModels: ["gpt-5.5"] },
      }]);
      db.getCustomModels.mockResolvedValueOnce([
        { providerAlias: "openai", id: "gpt-5.5", type: "llm", name: "My GPT", vendor: "bytedance" },
      ]);
      const model = findGpt55(await buildModelsList(["llm"]));
      expect(model).toMatchObject({ vendor: "bytedance" });
    });

    it("is emitted on the static fallback path and for web pseudo-models", async () => {
      db.getProviderConnections.mockResolvedValue([]);
      // alias "cc" must still resolve to the provider id behind it
      const staticModels = await buildModelsList(["llm"]);
      expect(staticModels.find((m) => m.id === "cc/claude-fable-5")).toMatchObject({ vendor: "claude" });
      db.getProviderConnections.mockResolvedValue([{ id: 1, provider: "brave-search", isActive: true, providerSpecificData: {} }]);
      const search = (await buildModelsList(["webSearch"])).find((m) => m.kind === "webSearch");
      expect(search).toMatchObject({ vendor: "brave-search" });
    });
  });
});

