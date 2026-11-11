import { describe, expect, it } from "vitest";
import { __test__ } from "../../open-sse/utils/requestLogger.js";

const { maskSensitiveHeaders, maskUrl } = __test__;
const SECRET = "sk-live-1234567890abcdefghijklmnop";

describe("requestLogger masking (ENABLE_REQUEST_LOGS files)", () => {
  it("masks credential headers but keeps the auth scheme and a short prefix/suffix", () => {
    const masked = maskSensitiveHeaders({
      Authorization: `Bearer ${SECRET}`,
      "x-api-key": SECRET,
      "x-goog-api-key": SECRET,
      "Proxy-Authorization": `Basic ${SECRET}`,
      Cookie: `session=${SECRET}`,
      "x-amz-security-token": SECRET,
      "content-type": "application/json",
    });
    expect(JSON.stringify(masked)).not.toContain(SECRET);
    expect(masked.Authorization).toBe("Bearer sk-l…mnop");
    expect(masked["Proxy-Authorization"]).toMatch(/^Basic /);
    expect(masked["content-type"]).toBe("application/json");
  });

  it("fully hides short secrets", () => {
    expect(maskSensitiveHeaders({ "x-api-key": "short" })["x-api-key"]).toBe("***");
  });

  it("accepts a Headers instance and set-cookie arrays", () => {
    const fromHeaders = maskSensitiveHeaders(new Headers({ authorization: `Bearer ${SECRET}`, accept: "*/*" }));
    expect(fromHeaders.authorization).not.toContain(SECRET);
    expect(fromHeaders.accept).toBe("*/*");

    const cookies = maskSensitiveHeaders({ "set-cookie": [`a=${SECRET}`, `b=${SECRET}`] })["set-cookie"];
    expect(cookies).toHaveLength(2);
    expect(JSON.stringify(cookies)).not.toContain(SECRET);
  });

  it("masks credentials in the query string", () => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/x:streamGenerateContent?alt=sse&key=${SECRET}`;
    expect(maskUrl(url)).toBe("https://generativelanguage.googleapis.com/v1beta/models/x:streamGenerateContent?alt=sse&key=***");
    expect(maskUrl(`https://h/p?access_token=${SECRET}&x=1`)).toBe("https://h/p?access_token=***&x=1");
    expect(maskUrl("https://h/p?monkey=1")).toBe("https://h/p?monkey=1");
  });
});
