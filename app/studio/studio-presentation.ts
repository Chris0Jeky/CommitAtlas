import { ProjectLinksSchema } from "@/packages/core/src/index";

export interface StarterCiPresentation {
  label: "Not configured" | "Preview required";
  tone: "muted";
  workflowLabel: string;
}

export function starterCiPresentation(workflow: string): StarterCiPresentation {
  const configuredWorkflow = workflow.trim();
  return configuredWorkflow
    ? { label: "Preview required", tone: "muted", workflowLabel: configuredWorkflow }
    : { label: "Not configured", tone: "muted", workflowLabel: "Not configured" };
}

export function activityBarPercent(count: number, maximum: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 1;
  return Math.min(100, Math.max(8, (count / safeMaximum) * 100));
}

export function contributionMetricLabel(returnedDays: number | null): string {
  return returnedDays === null ? "Contributions" : `Contributions · ${returnedDays}d`;
}

export function contributionWindowLabel(returnedDays: number, activityDays: number): string {
  return `${activityDays}-day activity · ${returnedDays}-day total`;
}

export function visibleProfileStars(stars: number, repositoriesTruncated: boolean): number | null {
  return repositoriesTruncated ? null : stars;
}

export function findProjectDraft<T extends { repo: string }>(
  drafts: readonly T[],
  repositoryName: string,
): T | undefined {
  const expected = repositoryName.trim().toLowerCase();
  return drafts.find((draft) => draft.repo.trim().toLowerCase() === expected);
}

export function safeProjectActionUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = ProjectLinksSchema.safeParse({ docs: value });
  if (!parsed.success || !parsed.data.docs) return null;
  return new URL(parsed.data.docs).toString();
}
