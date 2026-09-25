import type { DeliverySnapshot } from "@commit-atlas/github";
import { renderDeliveryCard as renderSharedDeliveryCard, type MotionProfile, type ThemeName } from "@commit-atlas/svg";

export interface DeliveryCardOptions {
  readonly theme?: ThemeName;
  readonly width?: number;
  readonly motion?: MotionProfile;
}

export function renderDeliveryEvidence(snapshot: DeliverySnapshot): string {
  const evidence = {
    schemaVersion: 1,
    kind: "commitatlas-delivery-evidence",
    version: snapshot.version,
    login: snapshot.login,
    scope: snapshot.scope,
    asOf: snapshot.asOf,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    lifetime: snapshot.lifetime,
    windows: snapshot.windows,
    repositories: [...snapshot.repositories].sort((left, right) => (
      left.repository.toLowerCase().localeCompare(right.repository.toLowerCase())
      || left.repository.localeCompare(right.repository)
    )),
    derived: snapshot.derived,
    benchmark: snapshot.benchmark,
    formulas: snapshot.formulas,
    limitations: snapshot.limitations,
  } as const;
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

/** Delegate presentation to the dependency-free shared SVG renderer. */
export function renderDeliveryCard(
  snapshot: DeliverySnapshot,
  options: DeliveryCardOptions = {},
): string {
  return renderSharedDeliveryCard(snapshot, { ...options, theme: options.theme ?? "aurora" });
}
