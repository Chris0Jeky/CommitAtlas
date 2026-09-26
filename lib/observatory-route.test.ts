import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  OBSERVATORY_ROUTE_EVENT,
  PULSEBOARD_ROUTE_ATTRIBUTE,
  PULSEBOARD_ROUTE_BOOTSTRAP,
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

test("the mounted App Router bridge forwards only route buckets to the SDK", async () => {
  const [bridge, layout] = await Promise.all([
    readFile(new URL("../app/observatory-route-bridge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(bridge, /usePathname\(\)/u);
  assert.match(bridge, /window\.location\.pathname/u);
  assert.match(bridge, /window\.dispatchEvent/u);
  assert.doesNotMatch(
    bridge,
    /\bfetch\s*\(|localStorage|sessionStorage|PulseboardUsage|page\.view|\.track\(|\.count\(/u,
    "the bridge must not collect, persist, or record anything but the route bucket",
  );
  assert.match(bridge, /pulseboardRoute\(detail\.route\)/u);
  // Layout effects run before every passive effect of the same commit, so the Studio's
  // `studio.opened` (a passive effect in `{children}`, rendered before the bridge) is counted
  // under `studio`, not the SDK's build-time `home`.
  assert.match(bridge, /useLayoutEffect\(\(\) => \{/u);
  assert.doesNotMatch(bridge, /\buseEffect\b/u);
  const studio = await readFile(new URL("../app/studio/studio-client.tsx", import.meta.url), "utf8");
  assert.match(studio, /useEffect\(\(\) => whenPulseboardReady\(\(\) => \{ pulseboardEvent\(\{ name: "studio\.opened"/u);
  assert.match(bridge, /if \(first\) return;/u, "the SDK records the first view from the landing attribute");
  assert.match(layout, /__html: PULSEBOARD_ROUTE_BOOTSTRAP/u);
  assert.match(layout, /<ObservatoryRouteBridge \/>/u);
  assert.match(layout, /<script defer src="\/pulseboard\.js" \/>/u);
  assert.match(layout, /<div data-pulseboard-bar="" style=\{\{ minHeight: "2\.5rem" \}\}/u);
  assert.doesNotMatch(layout, /observatory\.js/u);
});

test("the landing-route bootstrap writes exactly the bucket observatoryRouteFromPathname returns", () => {
  const paths = ["/", "/studio", "/studio/", "/studio/card/private-name", "/studios", "/api/v1/profile", "/x/studio", "", "/%2Fstudio"];
  for (const pathname of paths) {
    const attributes: Record<string, string> = {};
    vm.runInNewContext(PULSEBOARD_ROUTE_BOOTSTRAP, {
      location: { pathname },
      document: { documentElement: { setAttribute: (name: string, value: string) => { attributes[name] = value; } } },
    });
    assert.deepEqual(attributes, { [PULSEBOARD_ROUTE_ATTRIBUTE]: observatoryRouteFromPathname(pathname) }, pathname);
  }
  assert.equal(PULSEBOARD_ROUTE_ATTRIBUTE, "data-pulseboard-route");
  assert.doesNotMatch(PULSEBOARD_ROUTE_BOOTSTRAP, /<\/script/iu, "the inline script cannot close its own element");
  assert.doesNotThrow(() => vm.runInNewContext(PULSEBOARD_ROUTE_BOOTSTRAP, {}), "a missing DOM falls through silently");
});
