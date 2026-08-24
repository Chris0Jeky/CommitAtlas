"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  CHASSIS_THEME_ATTRIBUTE,
  CHASSIS_THEME_LIST,
  CHASSIS_THEME_STORAGE_KEY,
  DEFAULT_CHASSIS_THEME,
  isChassisThemeId,
  type ChassisThemeId,
} from "@/lib/chassis";

/**
 * The chassis theme switch.
 *
 * Persistence is `localStorage`, applied to `<html>` before first paint by the inline bootstrap in
 * the root layout. It is deliberately not a cookie: the HTML this Worker serves is otherwise
 * identical for every visitor and therefore cacheable, and fragmenting that cache per visitor to
 * carry a preference that costs one attribute on the client is a bad trade.
 *
 * The consequence is that the server always renders the default, so the control has to reconcile
 * with storage after hydration. `useSyncExternalStore` is that reconciliation: React renders
 * `getServerSnapshot` for hydration and switches to the live value immediately afterwards, with no
 * mismatch and no state written from inside an effect.
 *
 * **There is exactly one source of truth, and the attribute follows it.** An earlier version wrote
 * `data-chassis` from the click handler while the radios read from storage, which let the two
 * disagree in two real ways: a second tab's `storage` event moved its radios without repainting it,
 * and a failed `setItem` (private mode, blocked site data, quota) left the page repainted while the
 * control snapped back. Driving the attribute from the subscribed value makes both impossible —
 * whatever the radios say is what the page is wearing.
 *
 * The SVG card `theme=` query parameter is a different setting and is untouched by this control.
 */

const listeners = new Set<() => void>();

/**
 * The choice for this page view, held only while storage has refused to keep it.
 *
 * Without this, a visitor with blocked site data could not change the theme at all: the write would
 * throw, the read would return the default, and every click would revert. The preference still does
 * not survive a reload — that part is honest and unavoidable — but it works for the session.
 *
 * It is set only when the write actually failed, and cleared the moment one succeeds. That ordering
 * matters: a quota-exceeded write over an *existing* valid value leaves storage holding a stale
 * theme, and preferring it would snap the control back. While this is set, storage is known to be
 * lying about this key, so it is not consulted — which also means this tab stops following other
 * tabs, correctly, since it can no longer observe them.
 */
let sessionTheme: ChassisThemeId | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Module-scoped so the write is not a reassignment from inside the component's own scope. */
function rememberTheme(next: ChassisThemeId | null): void {
  sessionTheme = next;
}

function readTheme(): ChassisThemeId {
  if (sessionTheme) return sessionTheme;
  try {
    const stored = window.localStorage.getItem(CHASSIS_THEME_STORAGE_KEY);
    if (isChassisThemeId(stored)) return stored;
  } catch {
    // Private mode, blocked site data, or a partitioned storage bucket.
  }
  return DEFAULT_CHASSIS_THEME;
}

function serverTheme(): ChassisThemeId {
  return DEFAULT_CHASSIS_THEME;
}

export default function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  // The single write of `data-chassis` after first paint. It runs for a click, for another tab's
  // `storage` event, and for a storage failure alike, so the control and the page cannot diverge.
  useEffect(() => {
    document.documentElement.setAttribute(CHASSIS_THEME_ATTRIBUTE, theme);
  }, [theme]);

  function choose(next: ChassisThemeId): void {
    try {
      window.localStorage.setItem(CHASSIS_THEME_STORAGE_KEY, next);
      // Storage is authoritative again, including for other tabs.
      rememberTheme(null);
    } catch {
      // The theme still applies for this page view; it just will not survive a reload.
      rememberTheme(next);
    }
    for (const listener of [...listeners]) listener();
  }

  return (
    <fieldset className="theme-switch">
      <legend>Chassis theme</legend>
      {CHASSIS_THEME_LIST.map((option) => (
        <label key={option.id} title={`${option.label} — ${option.kicker}`}>
          <input
            type="radio"
            name="chassis-theme"
            value={option.id}
            checked={theme === option.id}
            onChange={() => choose(option.id)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
