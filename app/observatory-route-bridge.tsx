"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  OBSERVATORY_ROUTE_EVENT,
  observatoryRouteEventDetail,
  observatoryRouteFromPathname,
  type ObservatoryRoute,
  type ObservatoryRouteEventDetail,
} from "@/lib/observatory-route";
import { pulseboardRoute, whenPulseboardReady } from "@/lib/pulseboard";

/**
 * Publishes content-free route-bucket changes and forwards them to the Pulseboard SDK.
 *
 * The root layout and its deferred `pulseboard.js` stay mounted across App Router navigation. This
 * bridge derives the initial route from `location.pathname`, follows `usePathname()` updates, and emits
 * only the closed `home | studio | other` vocabulary: as the `commitatlas:observatory-route` window
 * event, and as `Pulseboard.route(bucket)` when the SDK is present. The SDK records its own first view
 * as `home` when it mounts, so the first bucket is forwarded only when it is not `home`; if the SDK has
 * not executed yet, that forward waits for the window `load` event once. The bridge itself grants no
 * consent, touches no storage and makes no request; the SDK applies the visitor's choice.
 */
export function ObservatoryRouteBridge() {
  const pathname = usePathname();
  const route = observatoryRouteFromPathname(pathname);
  const publishedRoute = useRef<ObservatoryRoute | null>(null);

  // A layout effect, so the route reaches the SDK before any page's passive effects (the Studio's
  // `studio.opened`) run in the same commit, even though this bridge renders after `{children}`.
  useLayoutEffect(() => {
    const locationDetail = observatoryRouteEventDetail(window.location.pathname);
    const detail: ObservatoryRouteEventDetail = locationDetail.route === route
      ? locationDetail
      : { route };

    if (publishedRoute.current === detail.route) return;
    const first = publishedRoute.current === null;
    publishedRoute.current = detail.route;
    window.dispatchEvent(
      new CustomEvent<ObservatoryRouteEventDetail>(OBSERVATORY_ROUTE_EVENT, { detail }),
    );

    if (first && detail.route === "home") return;
    return whenPulseboardReady(() => { pulseboardRoute(detail.route); });
  }, [route]);

  return null;
}
