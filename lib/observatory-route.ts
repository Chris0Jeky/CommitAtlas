export const OBSERVATORY_ROUTES = ["home", "studio", "other"] as const;
export type ObservatoryRoute = (typeof OBSERVATORY_ROUTES)[number];

export const OBSERVATORY_ROUTE_EVENT = "commitatlas:observatory-route";

export type ObservatoryRouteEventDetail = Readonly<{
  route: ObservatoryRoute;
}>;

export type ObservatoryRouteState = Readonly<{
  route: ObservatoryRoute;
  pageViewAnnounced: boolean;
}>;

export type AttributedObservatoryEvent = Readonly<{
  event: string;
  route: ObservatoryRoute;
}>;

export function observatoryRouteFromPathname(
  pathname: string | null | undefined,
): ObservatoryRoute {
  if (pathname === "/") return "home";
  if (pathname === "/studio" || pathname?.startsWith("/studio/")) {
    return "studio";
  }
  return "other";
}

export function observatoryRouteEventDetail(
  pathname: string | null | undefined,
): ObservatoryRouteEventDetail {
  return { route: observatoryRouteFromPathname(pathname) };
}

export function createObservatoryRouteState(
  initialPathname: string | null | undefined,
): ObservatoryRouteState {
  return {
    route: observatoryRouteFromPathname(initialPathname),
    pageViewAnnounced: false,
  };
}

export function navigateObservatoryRoute(
  state: ObservatoryRouteState,
  pathname: string | null | undefined,
): ObservatoryRouteState {
  const route = observatoryRouteFromPathname(pathname);
  return route === state.route ? state : { ...state, route };
}

export function announceObservatoryPageView(
  state: ObservatoryRouteState,
): Readonly<{
  state: ObservatoryRouteState;
  event: AttributedObservatoryEvent | null;
}> {
  if (state.pageViewAnnounced) return { state, event: null };
  return {
    state: { ...state, pageViewAnnounced: true },
    event: { event: "page.view", route: state.route },
  };
}

export function attributeObservatoryEvent(
  state: ObservatoryRouteState,
  event: string,
): AttributedObservatoryEvent {
  if (event.trim().length === 0) {
    throw new Error("Observatory event name must not be empty");
  }
  return { event, route: state.route };
}
