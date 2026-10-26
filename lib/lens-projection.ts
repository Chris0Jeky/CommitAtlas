import rawProjection from "@/research-contracts/lens-projection/v1/showcase.fixture.json";
import type { PortfolioSnapshot } from "./github/types";
import { createLensProjectionContext, type SceneLensProjection } from "@/packages/svg/src/index";

/** No projection argument: this hosted path can consume only the vendored C0 fixture. */
export function demoLensProjection(snapshot: PortfolioSnapshot): SceneLensProjection | undefined {
  if (snapshot.freshness.mode !== "demo" || snapshot.freshness.source !== "synthetic-demo") return undefined;
  try { return createLensProjectionContext(rawProjection, snapshot); }
  // A fixed fixture may be future-dated relative to a historical snapshot. Keep lens unavailable.
  catch { return undefined; }
}
