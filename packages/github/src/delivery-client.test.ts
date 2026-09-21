import assert from "node:assert/strict";
import test from "node:test";
import { GitHubApiError } from "./client.js";
import { fetchDeliverySnapshot } from "./delivery-client.js";
import { buildDeliveryQueryPlan } from "./delivery.js";

const NOW = new Date("2026-09-21T18:22:00.000Z");
const REPOSITORIES = ["Chris0Jeky/CommitAtlas"] as const;

function deliveryResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const plan = buildDeliveryQueryPlan({ login: "Chris0Jeky", repositories: REPOSITORIES, asOf: NOW });
  return {
    data: Object.fromEntries(plan.queries.map(({ alias }) => [alias, { issueCount: 0 }])),
    ...overrides,
  };
}

test("fetchDeliverySnapshot uses one aggregate-only GraphQL request scoped to configured repositories", async () => {
  const calls: Array<{ url: string; init: RequestInit; body: { query: string; variables: Record<string, string> } }> = [];
  const snapshot = await fetchDeliverySnapshot({
    token: "ghs_short_lived_action_token",
    login: "Chris0Jeky",
    repositories: REPOSITORIES,
    now: () => NOW,
    fetchImpl: async (input, init = {}) => {
      const url = String(input);
      const body = JSON.parse(String(init.body)) as { query: string; variables: Record<string, string> };
      calls.push({ url, init, body });
      return new Response(JSON.stringify(deliveryResponse()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call!.url, "https://api.github.com/graphql");
  assert.equal(new Headers(call!.init.headers).get("authorization"), "Bearer ghs_short_lived_action_token");
  assert.doesNotMatch(call!.body.query, /\b(title|body|comments|headRef|reviewers?|nodes?|edges?)\b/i);
  assert.ok(Object.values(call!.body.variables).every((query) => (
    query.includes("author:Chris0Jeky")
    && query.includes("repo:Chris0Jeky/CommitAtlas")
    && !query.includes("Private")
  )));
  assert.equal(snapshot.source.queryCount, 14);
  assert.equal(snapshot.scope.repositories[0], "Chris0Jeky/CommitAtlas");
});

test("fetchDeliverySnapshot requires a token before performing any request", async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchDeliverySnapshot({
      token: "",
      login: "Chris0Jeky",
      repositories: REPOSITORIES,
      now: () => NOW,
      fetchImpl: async () => {
        calls += 1;
        throw new Error("unexpected request");
      },
    }),
    (error: unknown) => error instanceof GitHubApiError && error.code === "token_required" && error.status === 503,
  );
  assert.equal(calls, 0);
});

test("fetchDeliverySnapshot rejects missing, malformed, and GraphQL-error count evidence", async () => {
  const cases: Array<{ payload: Record<string, unknown>; pattern: RegExp }> = [
    { payload: { data: {} }, pattern: /missing.*lifetimeAuthored/i },
    {
      payload: {
        data: {
          ...((deliveryResponse().data as Record<string, unknown>) ?? {}),
          opened7: { issueCount: "zero" },
        },
      },
      pattern: /opened7.*non-negative integer/i,
    },
    {
      payload: { data: null, errors: [{ type: "RATE_LIMITED", message: "rate limited" }] },
      pattern: /could not satisfy/i,
    },
  ];

  for (const { payload, pattern } of cases) {
    await assert.rejects(() => fetchDeliverySnapshot({
      token: "ghs_short_lived_action_token",
      login: "Chris0Jeky",
      repositories: REPOSITORIES,
      now: () => NOW,
      fetchImpl: async () => new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    }), pattern);
  }
});
