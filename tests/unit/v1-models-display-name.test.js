import { describe, expect, it, vi } from "vitest";

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
});
