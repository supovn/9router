import { describe, expect, it } from "vitest";
import { toMuseCookies } from "open-sse/executors/muse-web/session.js";
import { __parseCookieStringForTest as parseCookieString } from "open-sse/services/browserPool.js";

// A cookie header copied from DevTools on muse.ai carries `__Host-hatch_one_tap`.
// CDP Storage.setCookies rejects a __Host- cookie that has a Domain attribute, and
// one invalid entry fails the whole addCookies() call ("Invalid cookie fields").
describe("toMuseCookies", () => {
  const header = "hatch_sess=s1; __Host-hatch_one_tap=t1; hatch_gw=g1";

  it("scopes __Host- cookies by URL, without domain/path", () => {
    const hostCookie = toMuseCookies(header).find((c) => c.name === "__Host-hatch_one_tap");
    expect(hostCookie).toMatchObject({ url: "https://muse.ai/", secure: true });
    expect(hostCookie).not.toHaveProperty("domain");
    expect(hostCookie).not.toHaveProperty("path");
  });

  it("keeps regular cookies on the .muse.ai domain", () => {
    const sess = toMuseCookies(header).find((c) => c.name === "hatch_sess");
    expect(sess).toMatchObject({ domain: ".muse.ai", path: "/", value: "s1" });
    expect(sess).not.toHaveProperty("url");
  });
});

// browserPool seeds every new context from the same Cookie header before the
// executor's own addCookies() — it must apply the same __Host- rule.
describe("browserPool context seeding", () => {
  const header = "hatch_sess=s1; __Host-hatch_one_tap=t1";

  it("scopes __Host- cookies by URL (domain given with or without a leading dot)", () => {
    for (const domain of [".muse.ai", "muse.ai"]) {
      const hostCookie = parseCookieString(header, domain).find((c) => c.name === "__Host-hatch_one_tap");
      expect(hostCookie).toMatchObject({ url: "https://muse.ai/", secure: true });
      expect(hostCookie).not.toHaveProperty("domain");
      expect(hostCookie).not.toHaveProperty("path");
    }
  });

  it("keeps regular cookies on the dotted domain", () => {
    const sess = parseCookieString(header, "muse.ai").find((c) => c.name === "hatch_sess");
    expect(sess).toMatchObject({ domain: ".muse.ai", path: "/" });
  });
});
