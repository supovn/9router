import { describe, expect, it } from "vitest";
import { toMuseCookies } from "open-sse/executors/muse-web/session.js";

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
