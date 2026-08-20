import { isStudioCardAvailable } from "./studio-card-availability";
import {
  buildStudioRouteUrl,
  type StudioCardKind,
  type StudioProjectInput,
} from "./studio-urls";

export const STUDIO_CARD_KINDS: readonly StudioCardKind[] = [
  "profile",
  "streak",
  "activity",
  "languages",
  "projects",
];

export const STUDIO_CARD_LABELS: Readonly<Record<StudioCardKind, string>> = {
  profile: "Profile",
  streak: "Streak",
  activity: "Activity",
  languages: "Languages",
  projects: "Projects",
};

export interface StudioMarkdownOptions {
  baseUrl: string;
  owner: string;
  theme: string;
  demo: boolean;
  projects: StudioProjectInput[];
  selectedCards: ReadonlySet<StudioCardKind>;
  hasCurrentContributions: boolean;
  hasCurrentLanguages: boolean;
}

export function buildStudioMarkdown(options: StudioMarkdownOptions): string {
  return STUDIO_CARD_KINDS
    .filter((kind) => options.selectedCards.has(kind))
    .filter((kind) => kind !== "projects" || options.projects.length > 0)
    .filter((kind) => isStudioCardAvailable(kind, options))
    .map((kind) => {
      const url = buildStudioRouteUrl(kind, {
        owner: options.owner,
        projects: options.projects,
        theme: options.theme,
        demo: options.demo,
      });
      return `![CommitAtlas ${STUDIO_CARD_LABELS[kind]}](${options.baseUrl}${url})`;
    })
    .join("\n");
}
