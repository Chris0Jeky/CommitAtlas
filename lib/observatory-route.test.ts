import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OBSERVATORY_ROUTE_EVENT,
  announceObservatoryPageView,
  attributeObservatoryEvent,
  createObservatoryRouteState,
  navigateObservatoryRoute,
  observatoryRouteEventDetail,
  observatoryRouteFromPathname,
  type AttributedObservatoryEvent,
  type ObservatoryRouteState,
} from "./observatory-route";

type ScenarioStep =
  | { type: "enable-sharing" }
  | { type: "navigate"; pathname: string }
  | { type: "event"; event: string };

type RouteScenario = {
  name: string;
  initialPathname: string;
  steps: ScenarioStep[];
  expectedEvents: AttributedObservatoryEvent[];
};

const fixtureUrl = new URL(
  "../tests/fixtures/observatory/route-scenarios.json",
  import.meta.url,
);
const scenarios = JSON.parse(await readFile(fixtureUrl, "utf8")) as RouteScenario[];

for (const scenario of scenarios) {
  test(`Observatory route contract: ${scenario.name}`, () => {
    let state: ObservatoryRouteState = createObservatoryRouteState(
      scenario.initialPathname,
    );
    const events: AttributedObservatoryEvent[] = [];

    for (const step of scenario.steps) {
      if (step.type === "navigate") {
        state = navigateObservatoryRoute(state, step.pathname);
      } else if (step.type === "enable-sharing") {
        const announced = announceObservatoryPageView(state);
        state = announced.state;
        if (announced.event) events.push(announced.event);
      } else {
        events.push(attributeObservatoryEvent(state, step.event));
      }
    }

    assert.deepEqual(events, scenario.expectedEvents);
    assert.equal(
      events.filter((event) => event.event === "page.view").length,
      1,
      "one mounted client session may announce at most one page view",
    );
  });
}

test("route mapping exposes only the closed content-free vocabulary", () => {
  assert.equal(observatoryRouteFromPathname("/"), "home");
  assert.equal(observatoryRouteFromPathname("/studio"), "studio");
  assert.equal(observatoryRouteFromPathname("/studio/"), "studio");
  assert.equal(observatoryRouteFromPathname("/studio/card/private-name"), "studio");
  assert.equal(observatoryRouteFromPathname("/studios"), "other");
  assert.equal(observatoryRouteFromPathname("/anything/else"), "other");
  assert.equal(observatoryRouteFromPathname(null), "other");

  const detail = observatoryRouteEventDetail("/studio/card/private-name");
  assert.deepEqual(detail, { route: "studio" });
  assert.doesNotMatch(JSON.stringify(detail), /private-name/u);
  assert.equal(OBSERVATORY_ROUTE_EVENT, "commitatlas:observatory-route");
});

test("navigation within one route bucket is referentially stable", () => {
  const studio = createObservatoryRouteState("/studio");
  assert.equal(
    navigateObservatoryRoute(studio, "/studio/card"),
    studio,
    "the App Router bridge should not dispatch duplicate route updates",
  );
});

test("empty event names cannot become Observatory events", () => {
  const state = createObservatoryRouteState("/");
  assert.throws(() => attributeObservatoryEvent(state, ""), /event name/u);
});
