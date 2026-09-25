import assert from "node:assert/strict";
import test from "node:test";
import { CiStateSchema } from "@commit-atlas/core";
import { CI_RACK_ORDER, CI_STATE_PRESENTATION, summariseCiStates } from "./health";

test("the rack covers the core CI vocabulary exactly, with no state invented or dropped", () => {
  const core = [...CiStateSchema.options].sort();
  assert.deepEqual([...CI_RACK_ORDER].sort(), core);
  assert.deepEqual(Object.keys(CI_STATE_PRESENTATION).sort(), core);
  assert.equal(new Set(CI_RACK_ORDER).size, CI_RACK_ORDER.length);
});

test("the three unknown states lead the rack", () => {
  // Sorted by good news, "we do not know" reads as a leftover. Sorted this way it reads as a
  // finding, which is what the product says it is.
  assert.deepEqual(CI_RACK_ORDER.slice(0, 3), ["unavailable", "unconfigured", "stale"]);
});

test("every state survives greyscale: shape, glyph, word, and trace are all distinct", () => {
  const states = Object.values(CI_STATE_PRESENTATION);
  for (const key of ["word", "glyph", "lamp"] as const) {
    const values = states.map((state) => state[key]);
    assert.equal(new Set(values).size, values.length, `${key} is not unique across the six states`);
  }
  // Traces differ by stroke pattern, not only by colour: a flat rule, a dashed rule, a dotted
  // sawtooth, a solid sawtooth, a spiked sawtooth, and a solid run that decays into a dashed tail.
  const traces = states.map((state) => JSON.stringify(state.trace));
  assert.equal(new Set(traces).size, traces.length);
});

test("every state paints through an ink role, so a light theme cannot strand it", () => {
  // The canonical hex is what the contrast tests measure; the CSS variable is what the component
  // paints with, because the light chassis theme re-renders the palette darker and a hard-coded hex
  // would survive that swap and become illegible.
  for (const state of Object.values(CI_STATE_PRESENTATION)) {
    assert.match(state.cssVar, /^var\(--|^color-mix\(/, `${state.state} paints with a literal colour`);
    assert.doesNotMatch(state.cssVar, /#[0-9a-f]{3,8}/i, `${state.state} hard-codes a hex`);
  }
  const vars = Object.values(CI_STATE_PRESENTATION).filter((state) => state.colour !== null).map((state) => state.cssVar);
  assert.equal(new Set(vars).size, vars.length, "two tinted states share one ink role");
});

test("the states that mean 'nothing was observed' carry no colour of their own", () => {
  // Tinting them would put them on the same channel as a real reading. They are defined by absence,
  // so they are drawn in ink at reduced opacity and identified by shape and word.
  assert.equal(CI_STATE_PRESENTATION.unavailable.colour, null);
  assert.equal(CI_STATE_PRESENTATION.unconfigured.colour, null);
  for (const state of ["stale", "passing", "failing", "pending"] as const) {
    assert.match(CI_STATE_PRESENTATION[state].colour ?? "", /^#[0-9a-f]{6}$/i);
  }
  // Neither unknown state may borrow the passing tone.
  for (const state of ["unavailable", "unconfigured"] as const) {
    assert.equal(CI_STATE_PRESENTATION[state].tone, "unknown");
  }
});

test("pending is the only state allowed to pulse", () => {
  const pulsing = Object.values(CI_STATE_PRESENTATION).filter((state) => state.pulses);
  assert.deepEqual(pulsing.map((state) => state.state), ["pending"]);
});

test("every bay prints three lines of explanation rather than hiding them in a tooltip", () => {
  for (const state of Object.values(CI_STATE_PRESENTATION)) {
    assert.equal(state.description.length, 3, `${state.state} must print exactly three lines`);
    for (const line of state.description) assert.notEqual(line.trim(), "");
  }
});

test("a reading never folds an unknown signal into the passing count", () => {
  const reading = summariseCiStates(["passing", "unconfigured", "unavailable", "stale", "failing", "pending"]);
  assert.equal(reading.total, 6);
  assert.equal(reading.passing, 1);
  assert.equal(reading.attention, 3);
  assert.equal(reading.unknown, 2);
  assert.equal(reading.headline, "1/6 CI PASSING · 3 ATTENTION · 1 UNAVAILABLE · 1 UNCONFIGURED");
});

test("the landing page's own reading reports what is actually declared", () => {
  // Two projects, neither with a named workflow: the honest answer is two unconfigured probes, and
  // the headline must say so rather than reporting a clean zero-failure board.
  const reading = summariseCiStates(["unconfigured", "unconfigured"]);
  assert.equal(reading.headline, "0/2 CI PASSING · 0 ATTENTION · 2 UNCONFIGURED");
  assert.equal(reading.passing, 0);
  assert.equal(reading.unknown, 2);
});

test("an empty board reports nothing rather than a perfect score", () => {
  const reading = summariseCiStates([]);
  assert.equal(reading.total, 0);
  assert.equal(reading.headline, "0/0 CI PASSING · 0 ATTENTION");
  assert.doesNotMatch(reading.headline, /UNAVAILABLE|UNCONFIGURED/);
});

test("passing pins its tone, word, and pulse flag", () => {
  assert.equal(CI_STATE_PRESENTATION.passing.tone, "good");
  assert.equal(CI_STATE_PRESENTATION.passing.word, "PASSING");
  assert.equal(CI_STATE_PRESENTATION.passing.pulses, false);
});

test("failing pins its tone, word, and pulse flag", () => {
  assert.equal(CI_STATE_PRESENTATION.failing.tone, "bad");
  assert.equal(CI_STATE_PRESENTATION.failing.word, "FAILING");
  assert.equal(CI_STATE_PRESENTATION.failing.pulses, false);
});

test("pending pins its tone, word, and pulse flag", () => {
  assert.equal(CI_STATE_PRESENTATION.pending.tone, "warn");
  assert.equal(CI_STATE_PRESENTATION.pending.word, "PENDING");
  assert.equal(CI_STATE_PRESENTATION.pending.pulses, true);
});

test("stale pins its tone, word, and pulse flag", () => {
  assert.equal(CI_STATE_PRESENTATION.stale.tone, "warn");
  assert.equal(CI_STATE_PRESENTATION.stale.word, "STALE");
  assert.equal(CI_STATE_PRESENTATION.stale.pulses, false);
});

test("unavailable pins its tone, word, and pulse flag", () => {
  assert.equal(CI_STATE_PRESENTATION.unavailable.tone, "unknown");
  assert.equal(CI_STATE_PRESENTATION.unavailable.word, "UNAVAILABLE");
  assert.equal(CI_STATE_PRESENTATION.unavailable.pulses, false);
});

test("unconfigured pins its tone, word, and pulse flag", () => {
  assert.equal(CI_STATE_PRESENTATION.unconfigured.tone, "unknown");
  assert.equal(CI_STATE_PRESENTATION.unconfigured.word, "UNCONFIGURED");
  assert.equal(CI_STATE_PRESENTATION.unconfigured.pulses, false);
});

test("an unknown CI state has no presentation and never falls back to a healthy tone", () => {
  const byKey = CI_STATE_PRESENTATION as unknown as Record<string, unknown>;
  assert.equal(byKey["bogus"], undefined);
  assert.equal(byKey[""], undefined);
  for (const state of Object.values(CI_STATE_PRESENTATION)) {
    assert.ok(
      state.tone === "good" || state.tone === "warn" || state.tone === "bad" || state.tone === "unknown",
      `${state.state} carries an out-of-vocabulary tone`,
    );
  }
});
