import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `useSearchParams` opts its whole tree out of static prerendering. Without a
 * boundary the production build fails outright — and typecheck, lint and the
 * test suite all pass on that tree, so nothing else catches it.
 */
const page = readFileSync("app/[locale]/page.tsx", "utf8");
const screen = readFileSync("src/components/flood/FloodScreen.tsx", "utf8");

describe("the map screen still prerenders", () => {
  it("reads the query string", () => {
    expect(screen).toMatch(/useSearchParams/);
  });

  it("sits behind a Suspense boundary", () => {
    expect(page).toMatch(/import \{ Suspense \} from "react"/);
    expect(page).toMatch(/<Suspense>\s*<FloodScreen \/>\s*<\/Suspense>/);
  });
});
