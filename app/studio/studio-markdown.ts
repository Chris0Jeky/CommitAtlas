import { isStudioCardAvailable } from "./studio-card-availability";
import {
  buildStudioRouteUrl,
  type StudioCardKind,
  type StudioProjectInput,
} from "./studio-urls";

export const STUDIO_CARD_KINDS: readonly StudioCardKind[] = [
  "atlas",
  "profile",
  "streak",
  "breakdown",
  "rhythm",
  "activity",
  "languages",
  "projects",
];

export const STUDIO_CARD_LABELS: Readonly<Record<StudioCardKind, string>> = {
  atlas: "Atlas",
  profile: "Profile",
  streak: "Streak",
  breakdown: "Breakdown",
  rhythm: "Rhythm",
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
  motion?: "none" | "subtle";
  layout?: "wide" | "compact";
}

/**
 * The dark/light partner for a card theme.
 *
 * Mirrors `SvgTheme.pair` in `@commit-atlas/svg`. It is restated rather than imported because this
 * module is bundled into the client and importing the renderer would pull every card renderer into
 * the browser bundle to read four strings; `studio-markdown.test.ts` asserts the two agree.
 */
export const THEME_PAIRS: Readonly<Record<string, string>> = {
  ember: "paper",
  aurora: "paper",
  midnight: "paper",
  paper: "ember",
};

/** True when `theme` renders for a light colour scheme. */
export function isLightCardTheme(theme: string): boolean {
  return theme === "paper";
}

export function buildStudioMarkdown(options: StudioMarkdownOptions): string {
  const chosen = options.theme;
  const partner = THEME_PAIRS[chosen];
  const chosenIsLight = isLightCardTheme(chosen);

  return STUDIO_CARD_KINDS
    .filter((kind) => options.selectedCards.has(kind))
    .filter((kind) => kind !== "projects" || options.projects.length > 0)
    .filter((kind) => isStudioCardAvailable(kind, options))
    .map((kind) => {
      const label = `CommitAtlas ${STUDIO_CARD_LABELS[kind]}`;
      const urlFor = (theme: string) => `${options.baseUrl}${buildStudioRouteUrl(kind, {
        owner: options.owner,
        projects: options.projects,
        theme,
        demo: options.demo,
        days: 365,
        motion: options.motion,
        layout: options.layout,
      })}`;

      // Every card carries its own opaque background, so a single `![](…)` is a bet that the
      // reader's colour scheme matches the one theme it names — and it is wrong for everyone on
      // the other one. GitHub honours `<picture>` with `prefers-color-scheme` in Markdown, so the
      // pair ships together and the reader's own setting picks.
      //
      // The `<img>` fallback names the chosen theme, so a renderer that does not understand
      // `<picture>` still shows the card the user actually selected.
      if (!partner) return `![${label}](${urlFor(chosen)})`;
      const darkUrl = chosenIsLight ? urlFor(partner) : urlFor(chosen);
      const lightUrl = chosenIsLight ? urlFor(chosen) : urlFor(partner);
      return [
        "<picture>",
        `  <source media="(prefers-color-scheme: dark)" srcset="${darkUrl}">`,
        `  <source media="(prefers-color-scheme: light)" srcset="${lightUrl}">`,
        `  <img alt="${label}" src="${urlFor(chosen)}">`,
        "</picture>",
      ].join("\n");
    })
    .join("\n\n");
}
