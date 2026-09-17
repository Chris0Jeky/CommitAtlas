"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  OBSERVATORY_ROUTE_EVENT,
  observatoryRouteEventDetail,
  observatoryRouteFromPathname,
  type ObservatoryRoute,
  type ObservatoryRouteEventDetail,
} from "@/lib/observatory-route";

/**
 * Publishes content-free route-bucket changes for a future active Observatory adapter.
 *
 * The root layout and its versioned script stay mounted across App Router navigation. This bridge
 * therefore derives the initial route from `location.pathname`, follows `usePathname()` updates,
 * and emits only the closed `home | studio | other` vocabulary. It does not grant consent, track a
 * page view, touch storage, or make a network request.
 */
export function ObservatoryRouteBridge() {
  const pathname = usePathname();
  const route = observatoryRouteFromPathname(pathname);
  const publishedRoute = useRef<ObservatoryRoute | null>(null);

  useEffect(() => {
    const locationDetail = observatoryRouteEventDetail(window.location.pathname);
    const detail: ObservatoryRouteEventDetail = locationDetail.route === route
      ? locationDetail
      : { route };

    if (publishedRoute.current === detail.route) return;
    publishedRoute.current = detail.route;
    window.dispatchEvent(
      new CustomEvent<ObservatoryRouteEventDetail>(OBSERVATORY_ROUTE_EVENT, { detail }),
    );
  }, [route]);

  return null;
}
