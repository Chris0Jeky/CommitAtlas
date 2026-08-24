import assert from "node:assert/strict";
import test from "node:test";
import {
  CHASSIS_THEMES,
  DARK_INK_ROLES,
  INK_ROLE_CONTRAST_FLOOR,
  INK_ROLE_NAMES,
  LIGHT_INK_ROLES,
  SMALL_TEXT_INK_ROLES,
  THEME_INK_OVERRIDES,
  inkRolesFor,
  CHASSIS_THEME_BOOTSTRAP,
  CHASSIS_THEME_IDS,
  CHASSIS_THEME_LIST,
  DEFAULT_CHASSIS_THEME,
  STATUS_COLOURS,
  TEMPERATURE_SCALE,
  isChassisThemeId,
  resolveChassisTheme,
} from "./chassis";

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  assert.ok(match, `not an opaque hex colour: ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  return 0.2126 * channel((value >> 16) & 0xff)
    + 0.7152 * channel((value >> 8) & 0xff)
    + 0.0722 * channel(value & 0xff);
}

/** The floor a role owes: 4.5:1 where it prints small text, 3:1 where it only strokes or fills. */
function floorFor(role: string): number {
  return (SMALL_TEXT_INK_ROLES as readonly string[]).includes(role)
    ? INK_ROLE_CONTRAST_FLOOR.smallText
    : INK_ROLE_CONTRAST_FLOOR.graphic;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

test("every declared chassis theme is present, ordered, and self-describing", () => {
  assert.deepEqual(CHASSIS_THEME_LIST.map((theme) => theme.id), [...CHASSIS_THEME_IDS]);
  assert.equal(CHASSIS_THEME_IDS.includes(DEFAULT_CHASSIS_THEME), true);
  for (const theme of CHASSIS_THEME_LIST) {
    assert.equal(CHASSIS_THEMES[theme.id], theme);
    for (const [key, value] of Object.entries(theme)) {
      assert.equal(typeof value, "string", `${theme.id}.${key} must be a string`);
      assert.notEqual(value.trim(), "", `${theme.id}.${key} must not be blank`);
    }
  }
});

test("chrome distinguishes the themes from each other", () => {
  // Brightness and temperature are the only variables the chassis allows. If two themes shared a
  // chrome they would be the same theme wearing two names in the switch.
  const chromes = CHASSIS_THEME_LIST.map((theme) => theme.chrome.toLowerCase());
  assert.equal(new Set(chromes).size, chromes.length);
  const grounds = CHASSIS_THEME_LIST.map((theme) => theme.ground.toLowerCase());
  assert.equal(new Set(grounds).size, grounds.length);
});

test("text clears the WCAG AA floor on every theme ground", () => {
  // The chassis prints its secondary copy in 9–11px mono, which is small text under WCAG, so 4.5:1
  // is the floor for muted as well as for ink. This test is the reason `limestone.muted` is not the
  // value the design canvas used: that one measures 4.18.
  for (const theme of CHASSIS_THEME_LIST) {
    assert.ok(
      contrast(theme.ink, theme.ground) >= 7,
      `${theme.id}: ink on ground is ${contrast(theme.ink, theme.ground).toFixed(2)}:1, below the AAA floor for body text`,
    );
    assert.ok(
      contrast(theme.muted, theme.ground) >= 4.5,
      `${theme.id}: muted on ground is ${contrast(theme.muted, theme.ground).toFixed(2)}:1, below AA`,
    );
    assert.ok(
      contrast(theme.chrome, theme.ground) >= 4.5,
      `${theme.id}: chrome on ground is ${contrast(theme.chrome, theme.ground).toFixed(2)}:1, below AA`,
    );
  }
});

test("the light theme is never pure white and the dark themes are never pure black", () => {
  const limestone = CHASSIS_THEMES.limestone;
  assert.equal(limestone.colorScheme, "light");
  assert.notEqual(limestone.ground.toLowerCase(), "#ffffff");
  // A 3.2%-opacity survey grid is invisible on white. The ground has to keep enough tint for the
  // grid to register, which is the whole reason this theme is called Limestone.
  assert.ok(luminance(limestone.ground) < 0.9, "limestone ground is too bright to carry the survey grid");
  for (const theme of CHASSIS_THEME_LIST.filter((item) => item.colorScheme === "dark")) {
    assert.notEqual(theme.ground.toLowerCase(), "#000000");
    assert.ok(luminance(theme.ground) > 0, `${theme.id} ground is pure black`);
  }
});

test("the temperature scale and the status colours are shared, not per-theme", () => {
  // The hinge is the one value that must stay byte-identical between the page chrome and the SVG
  // cards it frames. A card embedded in a README and the plate around it have to agree.
  assert.equal(TEMPERATURE_SCALE.hinge, "#ffd166");
  assert.equal(STATUS_COLOURS.pending, TEMPERATURE_SCALE.hinge);
  // The scale itself is one ordered ramp shared by both stations, so no two stops may collide.
  const scale = Object.values(TEMPERATURE_SCALE).map((colour) => colour.toLowerCase());
  assert.equal(new Set(scale).size, scale.length);
  // Note that `observatory.chrome` deliberately *is* the hinge — that theme is the earlier warm
  // revision, whose chrome was the gold hinge before Fieldline introduced signal lime. So chrome
  // and temperature are allowed to coincide; what must not happen is a *theme* redefining a
  // temperature value, which would make one station's ember differ from the other's.
  for (const theme of CHASSIS_THEME_LIST) {
    assert.equal(Object.hasOwn(theme, "ember"), false, `${theme.id} redefines a temperature value`);
    assert.equal(Object.hasOwn(theme, "violet"), false, `${theme.id} redefines a temperature value`);
  }
});

test("resolveChassisTheme falls back rather than throwing on an unknown value", () => {
  assert.equal(resolveChassisTheme("limestone").id, "limestone");
  for (const rejected of [undefined, null, "", "FIELDLINE", "neon", 3, {}]) {
    assert.equal(isChassisThemeId(rejected), false, `${String(rejected)} was accepted as a theme id`);
    assert.equal(resolveChassisTheme(rejected).id, DEFAULT_CHASSIS_THEME);
  }
});

test("the no-flash bootstrap cannot break out of its own script element", () => {
  // It is inlined into `<head>` with `dangerouslySetInnerHTML`, so a stray `</script>` — or an
  // unescaped quote in a theme id — would end the element early and dump the rest as page text.
  assert.doesNotMatch(CHASSIS_THEME_BOOTSTRAP, /<\/script|<!--/i);
  assert.match(CHASSIS_THEME_BOOTSTRAP, /^\(function\(\)\{try\{/);
  assert.match(CHASSIS_THEME_BOOTSTRAP, /catch\(e\)\{\}\}\)\(\);$/);
  for (const id of CHASSIS_THEME_IDS) {
    assert.ok(CHASSIS_THEME_BOOTSTRAP.includes(`"${id}"`), `${id} is missing from the bootstrap allowlist`);
  }
});

test("the ink roles cover the palette exactly, on both grounds", () => {
  for (const roles of [DARK_INK_ROLES, LIGHT_INK_ROLES]) {
    assert.deepEqual(Object.keys(roles).sort(), [...INK_ROLE_NAMES].sort());
    for (const [role, colour] of Object.entries(roles)) {
      assert.match(colour, /^#[0-9a-f]{6}$/i, `${role} is not an opaque hex`);
    }
  }
});

test("the dark ink roles are the scale itself, unmodified", () => {
  // A dark ground needs no adaptation. If these ever drift, the page chrome and the SVG cards it
  // frames stop agreeing, which is the one thing the hinge exists to prevent.
  assert.equal(DARK_INK_ROLES["warm-line"], TEMPERATURE_SCALE.ember);
  assert.equal(DARK_INK_ROLES["cool-ink"], TEMPERATURE_SCALE.aqua);
  assert.equal(DARK_INK_ROLES["hinge-ink"], TEMPERATURE_SCALE.hinge);
  assert.equal(DARK_INK_ROLES["pass-ink"], STATUS_COLOURS.passing);
});

test("the raw temperature scale is unusable as ink on the light ground, and the light roles fix it", () => {
  const limestone = CHASSIS_THEMES.limestone;
  // The premise: this is *why* the light roles exist. If the scale ever became legible here on its
  // own, this test fails loudly rather than leaving a now-pointless second palette in place.
  for (const [name, colour] of Object.entries(TEMPERATURE_SCALE)) {
    assert.ok(
      contrast(colour, limestone.plate) < 3,
      `${name} now measures ${contrast(colour, limestone.plate).toFixed(2)}:1 on the Limestone plate — the light ink roles may no longer be needed`,
    );
  }
  // And the replacement clears AA on both the plate and the ground, at the floor its role owes.
  for (const [role, colour] of Object.entries(LIGHT_INK_ROLES)) {
    const floor = floorFor(role);
    for (const [surface, ground] of [["plate", limestone.plate], ["ground", limestone.ground]] as const) {
      assert.ok(
        contrast(colour, ground) >= floor,
        `${role} on the Limestone ${surface} is ${contrast(colour, ground).toFixed(2)}:1, below its ${floor}:1 floor`,
      );
    }
  }
});

test("every theme's rendered ink clears the floor its role owes, on its own ground and plate", () => {
  for (const theme of CHASSIS_THEME_LIST) {
    for (const [role, colour] of Object.entries(inkRolesFor(theme.id))) {
      const floor = floorFor(role);
      for (const [surface, ground] of [["ground", theme.ground], ["plate", theme.plate]] as const) {
        assert.ok(
          contrast(colour, ground) >= floor,
          `${role} on the ${theme.id} ${surface} is ${contrast(colour, ground).toFixed(2)}:1, below its ${floor}:1 floor`,
        );
      }
    }
  }
});

test("a per-theme override exists only where the shared value could not clear the floor", () => {
  // Guards against an override drifting into a taste change. Each one has to be a value the shared
  // table genuinely fails on for that theme.
  for (const [themeId, overrides] of Object.entries(THEME_INK_OVERRIDES)) {
    const theme = CHASSIS_THEMES[themeId as keyof typeof CHASSIS_THEMES];
    const shared = theme.colorScheme === "light" ? LIGHT_INK_ROLES : DARK_INK_ROLES;
    for (const role of Object.keys(overrides ?? {})) {
      const floor = floorFor(role);
      const before = contrast(shared[role as keyof typeof shared], theme.ground);
      assert.ok(before < floor, `${themeId} overrides ${role}, but the shared value already measures ${before.toFixed(2)}:1`);
    }
  }
});

test("only the graphic role is exempt from the small-text floor", () => {
  // If this list ever grows, something is being painted as small text at a graphic's contrast.
  assert.deepEqual(
    INK_ROLE_NAMES.filter((role) => !SMALL_TEXT_INK_ROLES.includes(role)),
    ["warm-line"],
  );
});
