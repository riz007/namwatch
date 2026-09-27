import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The consent notice promises that nothing leaves the device until someone
 * accepts. That promise is only worth anything if every analytics client is
 * behind the same gate — it is easy to add the next one straight into the
 * layout, the way each vendor's quickstart tells you to.
 */
const analytics = readFileSync("src/components/Analytics.tsx", "utf8");
const layout = readFileSync("app/[locale]/layout.tsx", "utf8");

describe("analytics consent gate", () => {
  it("renders Vercel Web Analytics only once consent is granted", () => {
    const tag = analytics.slice(analytics.indexOf("<VercelAnalytics"));
    const before = analytics.slice(0, analytics.indexOf("<VercelAnalytics"));
    // The guard sits immediately above the tag, not somewhere up the file.
    expect(before.trimEnd().endsWith('{consent === "granted" && (')).toBe(true);
    expect(tag).toMatch(/beforeSend=/);
  });

  it("keeps the Google tag behind the same gate", () => {
    expect(analytics).toMatch(/gaId !== null && consent === "granted" &&/);
  });

  it("does not mount any analytics client straight into the layout", () => {
    // Only the local consent gate belongs here; a vendor import would bypass it.
    expect(layout).toMatch(/from "@\/components\/Analytics\.tsx"/);
    expect(layout).not.toMatch(/@vercel\/analytics/);
    expect(layout).not.toMatch(/googletagmanager/);
  });

  it("asks for consent even when no Google tag is configured", () => {
    // Vercel Web Analytics ships with the deployment, so gating the banner on
    // the GA id alone would leave it collecting with nothing ever asked.
    expect(analytics).toMatch(/const showBanner = consent === null;/);
  });

  it("strips query strings before an event is sent", () => {
    expect(analytics).toMatch(/url: event\.url\.split\(\/\[\?#\]\/\)\[0\]/);
  });
});
