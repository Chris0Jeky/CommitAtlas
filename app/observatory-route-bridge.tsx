"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  OBSERVATORY_ROUTE_EVENT,
  PULSEBOARD_ROUTE_ATTRIBUTE,
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
 * event, and as `Pulseboard.route(bucket)` when the SDK is present. The SDK records the first view itself,
 * for the bucket the layout wrote to `<html data-pulseboard-route>`, so only later navigations are
 * forwarded; if the SDK has not executed yet, a forward waits for the window `load` event once. The bridge itself grants no
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

    // Keep the landing attribute current, so an SDK that remounts after a bfcache restore starts here.
    document.documentElement.setAttribute(PULSEBOARD_ROUTE_ATTRIBUTE, detail.route);
    // The first bucket is already on <html data-pulseboard-route> (set in the layout head), which the
    // SDK reads at mount; forwarding it too would record a second first view.
    if (first) return;
    return whenPulseboardReady(() => { pulseboardRoute(detail.route); });
  }, [route]);

  return null;
}
