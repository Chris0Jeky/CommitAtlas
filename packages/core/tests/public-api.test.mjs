import assert from "node:assert/strict";
import test from "node:test";
import { contributionCalendarDays, parseHandle, repoSlug } from "@commit-atlas/core";

const repo = () => ({ version: 1, owner: "Octo-Cat", name: "My.Repo_name-1" });
const calendar = (days = [{ date: "2024-02-29", count: 0 }]) => ({ version: 1, days });
const dateAt = index => new Date(Date.UTC(2024, 0, index + 1)).toISOString().slice(0, 10);

test("repoSlug validates and normalizes owners while preserving repository case", () => {
  const input = Object.freeze({ ...repo(), owner: "  Octo-Cat  ", name: " My.Repo_name-1 " });
  assert.equal(repoSlug(input), "octo-cat/My.Repo_name-1");
  assert.equal(input.owner, "  Octo-Cat  ");
  assert.equal(input.name, " My.Repo_name-1 ");
});

test("repoSlug accepts exact owner and repository length bounds", () => {
  for (const [owner, name] of [["A", "R"], ["A".repeat(39), "R".repeat(100)]]) {
    assert.equal(repoSlug({ version: 1, owner, name }), `${owner.toLowerCase()}/${name}`);
  }
});

test("repoSlug rejects malformed repository inputs instead of interpolating them", () => {
  for (const value of [null, undefined, [], "owner/repo", {}, { ...repo(), version: 2 },
    { owner: "owner", name: "repo" }, { ...repo(), extra: true },
    ...["", "-owner", "owner-", "a--b", "a/b", "a b", "界", "a".repeat(40), 1]
      .map(owner => ({ ...repo(), owner })),
    ...["", ".", "..", "a..b", "a/b", "a b", "界", "a".repeat(101), 1]
      .map(name => ({ ...repo(), name })),
  ]) assert.throws(() => repoSlug(value), { name: "ZodError" });
});

test("parseHandle returns a normalized detached record without mutating its input", () => {
  const input = Object.freeze({ version: 1, handle: "  Octo-Cat  " });
  const first = parseHandle(input);
  assert.deepEqual(first, { version: 1, handle: "octo-cat" });
  assert.notEqual(first, input);
  first.handle = "changed";
  assert.deepEqual(parseHandle(input), { version: 1, handle: "octo-cat" });
  assert.equal(input.handle, "  Octo-Cat  ");
});

test("parseHandle accepts exact bounds and refuses malformed or unversioned records", () => {
  for (const handle of ["A", "A".repeat(39)]) {
    assert.deepEqual(parseHandle({ version: 1, handle }), { version: 1, handle: handle.toLowerCase() });
  }
  for (const input of [null, [], "owner", {}, { handle: "owner" },
    { version: 2, handle: "owner" }, { version: 1, handle: "owner", extra: true },
    ...["", "-owner", "owner-", "a--b", "a/b", "a b", "界", "a".repeat(40), 1]
      .map(handle => ({ version: 1, handle })),
  ]) assert.throws(() => parseHandle(input), { name: "ZodError" });
});

test("contributionCalendarDays sorts observed dates without filling missing days", () => {
  const input = calendar([
    { date: "2024-03-02", count: 3, level: 2 },
    { date: "2024-02-28", count: 0 },
    { date: "2024-02-29", count: 100_000, level: 4 },
  ]);
  const original = structuredClone(input);
  assert.deepEqual(contributionCalendarDays(input), [
    { date: "2024-02-28", count: 0, level: 0 },
    { date: "2024-02-29", count: 100_000, level: 4 },
    { date: "2024-03-02", count: 3, level: 2 },
  ]);
  assert.deepEqual(input, original, "sorting and default levels must not mutate input");
});

test("contributionCalendarDays detaches the returned array and every day record", () => {
  const day = Object.freeze({ date: "2024-02-29", count: 0 });
  const input = Object.freeze({ version: 1, days: Object.freeze([day]) });
  const output = contributionCalendarDays(input);
  assert.notEqual(output, input.days);
  assert.notEqual(output[0], day);
  output[0].count = 9;
  output.push({ date: "2024-03-01", count: 8, level: 2 });
  assert.deepEqual(contributionCalendarDays(input), [{ date: "2024-02-29", count: 0, level: 0 }]);
});

test("contributionCalendarDays enforces its versioned envelope, not the bare metric-array form", () => {
  for (const input of [null, undefined, [], calendar().days, {}, { days: calendar().days },
    { ...calendar(), version: 2 }, { ...calendar(), extra: true },
    { ...calendar(), days: null }, { ...calendar(), days: {} },
  ]) assert.throws(() => contributionCalendarDays(input), { name: "ZodError" });
});

test("contributionCalendarDays accepts one through 400 records and refuses empty, sparse or oversized calendars", () => {
  assert.equal(contributionCalendarDays(calendar()).length, 1);
  const maximum = Array.from({ length: 400 }, (_, i) => ({ date: dateAt(i), count: 0 }));
  const output = contributionCalendarDays(calendar(maximum));
  assert.equal(output.length, 400);
  assert.equal(output[0].date, dateAt(0));
  assert.equal(output.at(-1).date, dateAt(399));
  for (const days of [[], new Array(1), [...maximum, { date: dateAt(400), count: 0 }]]) {
    assert.throws(() => contributionCalendarDays(calendar(days)), { name: "ZodError" });
  }
});

test("contributionCalendarDays rejects duplicate dates even when separated or carrying different counts", () => {
  for (const count of [0, 3]) {
    assert.throws(() => contributionCalendarDays(calendar([
      { date: "2024-02-29", count: 0 }, { date: "2024-03-01", count: 1 },
      { date: "2024-02-29", count },
    ])), /Duplicate contribution date: 2024-02-29/);
  }
});

test("contributionCalendarDays validates real UTC dates rather than accepting calendar rollover", () => {
  for (const date of ["2023-02-29", "2024-02-30", "2024-04-31", "2024-00-01", "2024-13-01",
    "2024-01-00", "2024-2-29", "2024-02-29T00:00:00Z", "2024-02-29\n", "", null,
  ]) assert.throws(() => contributionCalendarDays(calendar([{ date, count: 0 }])), { name: "ZodError" });
  assert.deepEqual(contributionCalendarDays(calendar([{ date: "2000-02-29", count: 0 }])),
    [{ date: "2000-02-29", count: 0, level: 0 }]);
});

test("contributionCalendarDays keeps zero observed and enforces count, level and day-record bounds", () => {
  for (const count of [0, 100_000]) for (const level of [0, 4]) {
    assert.deepEqual(contributionCalendarDays(calendar([{ date: "2024-02-29", count, level }])),
      [{ date: "2024-02-29", count, level }]);
  }
  const valid = { date: "2024-02-29", count: 0, level: 0 };
  for (const day of [null, [], {}, { ...valid, extra: true },
    ...[-1, 100_001, 0.5, NaN, Infinity, "0", null, undefined].map(count => ({ ...valid, count })),
    ...[-1, 5, 0.5, NaN, Infinity, "0", null].map(level => ({ ...valid, level })),
  ]) assert.throws(() => contributionCalendarDays(calendar([day])), { name: "ZodError" });
});
