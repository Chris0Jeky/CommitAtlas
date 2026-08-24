/**
 * The shared-chassis token contract for the CommitAtlas web surface.
 *
 * The design system has exactly one brand variable: **temperature**. Everything else — the survey
 * grid, the mono-over-sans hierarchy, the corner cuts, the numerals — is chassis, and it does not
 * change between themes. A chassis theme therefore adjusts brightness and chrome only; it never
 * touches the temperature scale (`--ember` … `--violet`) and it never touches the SVG card themes,
 * which are a separate, caller-supplied `theme=` query parameter on the render routes.
 *
 * These values are the single source of truth. `app/globals.css` emits them, `app/layout.tsx`
 * reads `themeColor` from them, and `chassis.test.ts` asserts the contrast floors that make the
 * light theme usable. Duplicating a hex anywhere else lets one surface drift from another.
 */

export const CHASSIS_THEME_IDS = ["fieldline", "observatory", "midline", "limestone"] as const;
export type ChassisThemeId = (typeof CHASSIS_THEME_IDS)[number];

export const DEFAULT_CHASSIS_THEME: ChassisThemeId = "fieldline";

/** The `localStorage` key and the `data-` attribute the no-flash script writes. */
export const CHASSIS_THEME_STORAGE_KEY = "commitatlas:chassis-theme";
export const CHASSIS_THEME_ATTRIBUTE = "data-chassis";

export interface ChassisTheme {
  id: ChassisThemeId;
  /** Display name, shown in the theme switch. */
  label: string;
  /** Mono kicker, shown under the name. */
  kicker: string;
  /** Page ground. Never pure black, never pure white. */
  ground: string;
  /** Raised plate — card frames, tiles, rack bays. */
  plate: string;
  /** Translucent instrument fascia, layered over the survey grid. */
  fascia: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. Held to WCAG AA against `ground` by `chassis.test.ts`. */
  muted: string;
  /** Hairline rules and panel borders. */
  line: string;
  /** Labels, badges, marks, section numerals. */
  chrome: string;
  /** The 42px survey grid stroke. */
  grid: string;
  /** Browser chrome colour and the `color-scheme` this theme reads as. */
  colorScheme: "dark" | "light";
}

/**
 * Ordered as the switch presents them: darkest first, light last.
 *
 * `limestone` is deliberately not `#ffffff`. A pure-white ground under a 1.8%-opacity survey grid
 * renders the grid invisible and the whole chassis collapses into an ordinary light page.
 */
export const CHASSIS_THEMES: Readonly<Record<ChassisThemeId, ChassisTheme>> = {
  fieldline: {
    id: "fieldline",
    label: "Fieldline",
    kicker: "DARK · DEFAULT",
    ground: "#0e0f0d",
    plate: "#121310",
    fascia: "rgba(20, 22, 16, 0.6)",
    ink: "#edf0e2",
    muted: "#9aa08c",
    line: "rgba(237, 240, 226, 0.13)",
    chrome: "#d9ff4a",
    grid: "rgba(255, 255, 255, 0.018)",
    colorScheme: "dark",
  },
  observatory: {
    id: "observatory",
    label: "Observatory",
    kicker: "DARK WARM",
    ground: "#11110f",
    plate: "#191916",
    fascia: "rgba(26, 26, 22, 0.6)",
    ink: "#eee9e1",
    muted: "#a9a198",
    line: "rgba(238, 233, 225, 0.13)",
    chrome: "#ffd166",
    grid: "rgba(255, 255, 255, 0.018)",
    colorScheme: "dark",
  },
  midline: {
    id: "midline",
    label: "Midline",
    kicker: "MID · READING",
    ground: "#3a3d33",
    plate: "#32352b",
    fascia: "rgba(46, 49, 39, 0.62)",
    ink: "#f0f2e4",
    muted: "#c4c8b4",
    line: "rgba(240, 242, 228, 0.18)",
    chrome: "#e6ff70",
    grid: "rgba(255, 255, 255, 0.03)",
    colorScheme: "dark",
  },
  limestone: {
    id: "limestone",
    label: "Limestone",
    kicker: "LIGHT · NO PURE WHITE",
    ground: "#e8ecd6",
    plate: "#dfe4c9",
    fascia: "rgba(223, 228, 201, 0.66)",
    ink: "#23261c",
    // The canvas specimen used `#6b7160`, which measures 4.18:1 on this ground. The chassis prints
    // its secondary copy at 9–11px, so that is small text and 4.18 is under the AA floor. Darkened
    // until it clears 4.5:1 — the label colour is chrome-driven anyway, so nothing else moves.
    muted: "#5b6150",
    line: "rgba(35, 38, 28, 0.18)",
    chrome: "#55651a",
    grid: "rgba(35, 38, 28, 0.032)",
    colorScheme: "light",
  },
};

export const CHASSIS_THEME_LIST: readonly ChassisTheme[] = CHASSIS_THEME_IDS.map((id) => CHASSIS_THEMES[id]);

/**
 * The temperature scale. One instrument scale, not two brands.
 *
 * `hinge` is the value the SVG cards already use for their own data accents; it stays byte-identical
 * across every surface so a card embedded in a README and the page that frames it agree.
 */
export const TEMPERATURE_SCALE = {
  ember: "#ff7a45",
  emberSoft: "#ff9f68",
  gold: "#ffc857",
  hinge: "#ffd166",
  aqua: "#58e6be",
  midAqua: "#8fd8d2",
  violet: "#b89bff",
  violetSoft: "#d9caff",
} as const;

/**
 * Status colours, shared by every theme.
 *
 * Colour is never the only encoding. Each state also carries a distinct lamp shape, a distinct
 * trace, and a printed word — see `CI_STATE_PRESENTATION` in `lib/health.ts`.
 */
export const STATUS_COLOURS = {
  passing: "#75d69b",
  failing: "#ff7b7b",
  pending: "#ffd166",
  stale: "#c9a35a",
} as const;

/**
 * Ink roles: a temperature or status colour at the moment it is painted as *text or a small mark*
 * rather than as a large graphic.
 *
 * On a dark ground these are the scale itself. On a light ground they cannot be — every value in
 * `TEMPERATURE_SCALE` measures between 1.1:1 and 2.1:1 against Limestone, which is unreadable as
 * text and below the 3:1 floor even for a graphical mark. The chassis already solves this once, for
 * chrome: Fieldline's signal lime becomes Limestone's olive, same hue, darkened for the ground. An
 * ink role is that same rule applied to the rest of the palette, so `LIGHT_INK_ROLES` is a
 * *rendering* of the scale on a pale ground, not a second palette.
 *
 * The scale bar itself keeps the raw ramp on every theme: it is a large swatch whose job is to show
 * the scale, and darkening it there would be showing something else.
 */
export const INK_ROLE_NAMES = [
  "warm-ink",
  "warm-line",
  "cool-ink",
  "violet-ink",
  "violet-soft-ink",
  "hinge-ink",
  "pass-ink",
  "fail-ink",
  "stale-ink",
  "pending-ink",
] as const;
export type InkRole = (typeof INK_ROLE_NAMES)[number];

/** Dark-ground ink roles: the scale, unchanged. */
export const DARK_INK_ROLES: Readonly<Record<InkRole, string>> = {
  "warm-ink": TEMPERATURE_SCALE.emberSoft,
  "warm-line": TEMPERATURE_SCALE.ember,
  "cool-ink": TEMPERATURE_SCALE.aqua,
  "violet-ink": TEMPERATURE_SCALE.violet,
  "violet-soft-ink": TEMPERATURE_SCALE.violetSoft,
  "hinge-ink": TEMPERATURE_SCALE.hinge,
  "pass-ink": STATUS_COLOURS.passing,
  "fail-ink": STATUS_COLOURS.failing,
  "stale-ink": STATUS_COLOURS.stale,
  "pending-ink": STATUS_COLOURS.pending,
};

/** Light-ground ink roles. Same hues, darkened until each clears 4.5:1 on the Limestone plate. */
export const LIGHT_INK_ROLES: Readonly<Record<InkRole, string>> = {
  "warm-ink": "#9c3d0d",
  "warm-line": "#b3491a",
  "cool-ink": "#0f5f50",
  "violet-ink": "#4d3494",
  "violet-soft-ink": "#5b3fa8",
  "hinge-ink": "#6b4f08",
  "pass-ink": "#186b3c",
  "fail-ink": "#8f1c1c",
  "stale-ink": "#6d5410",
  "pending-ink": "#6b4f08",
};

/**
 * The ink roles that are painted as *small text* and therefore owe WCAG's 4.5:1.
 *
 * `warm-line` is deliberately absent. It strokes the plotter trace, fills the density grid, and
 * colours the 25px display italic on the warm station tile — a graphic and large text, both of
 * which sit under the 3:1 non-text/large-text floor rather than the small-text one. Holding it to
 * 4.5 would force the ember trace darker than the scale it is supposed to be showing.
 */
export const SMALL_TEXT_INK_ROLES: readonly InkRole[] = INK_ROLE_NAMES.filter((role) => role !== "warm-line");

/** WCAG floors, by what the role is actually used to paint. */
export const INK_ROLE_CONTRAST_FLOOR = { smallText: 4.5, graphic: 3 } as const;

/**
 * Per-theme ink overrides.
 *
 * Midline is the one ground bright enough to strand a dark-ground ink: the failing red measures
 * 4.42:1 there, just under the small-text floor, while clearing it comfortably on Fieldline and
 * Observatory. Lightening the shared value to fix one theme would move the other three away from
 * the specified colour, so the *rendering* shifts and the canonical value stays put — which is
 * exactly what an ink role is for.
 */
export const THEME_INK_OVERRIDES: Readonly<Partial<Record<ChassisThemeId, Partial<Record<InkRole, string>>>>> = {
  midline: { "fail-ink": "#ff8a8a" },
};

/** The ink roles as a given theme actually renders them. */
export function inkRolesFor(theme: ChassisThemeId): Readonly<Record<InkRole, string>> {
  const base = CHASSIS_THEMES[theme].colorScheme === "light" ? LIGHT_INK_ROLES : DARK_INK_ROLES;
  return { ...base, ...THEME_INK_OVERRIDES[theme] };
}

export function isChassisThemeId(value: unknown): value is ChassisThemeId {
  return typeof value === "string" && (CHASSIS_THEME_IDS as readonly string[]).includes(value);
}

export function resolveChassisTheme(value: unknown): ChassisTheme {
  return CHASSIS_THEMES[isChassisThemeId(value) ? value : DEFAULT_CHASSIS_THEME];
}

/**
 * The no-flash bootstrap, inlined into `<head>` ahead of first paint.
 *
 * A stored theme has to be applied before the browser paints, or a Limestone reader gets a
 * full-page flash of the Fieldline ground on every navigation. There is no server-side cookie
 * because the canonical HTML is cacheable and a per-visitor variant would fragment that cache for
 * a preference that costs one attribute to apply on the client.
 *
 * It is deliberately total: any storage failure (private mode, blocked site data, a value written
 * by an older build) falls through to the default rather than throwing before hydration.
 */
export const CHASSIS_THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  CHASSIS_THEME_STORAGE_KEY,
)});if(${JSON.stringify(CHASSIS_THEME_IDS)}.indexOf(t)>-1){document.documentElement.setAttribute(${JSON.stringify(
  CHASSIS_THEME_ATTRIBUTE,
)},t);}}catch(e){}})();`;
