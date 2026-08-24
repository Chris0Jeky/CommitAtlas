"use client";

import { useSyncExternalStore } from "react";
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
 * with storage after hydration. `useSyncExternalStore` is exactly that reconciliation: React renders
 * `getServerSnapshot` for hydration and switches to the live value immediately afterwards, with no
 * mismatch and no state written from inside an effect. Subscribing to `storage` is a free bonus —
 * changing the theme in one tab now updates every other open tab.
 *
 * The SVG card `theme=` query parameter is a different setting and is untouched by this control.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): ChassisThemeId {
  try {
    const stored = window.localStorage.getItem(CHASSIS_THEME_STORAGE_KEY);
    return isChassisThemeId(stored) ? stored : DEFAULT_CHASSIS_THEME;
  } catch {
    // Private mode, blocked site data, or a partitioned storage bucket. The default is correct.
    return DEFAULT_CHASSIS_THEME;
  }
}

function serverTheme(): ChassisThemeId {
  return DEFAULT_CHASSIS_THEME;
}

export default function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  function choose(next: ChassisThemeId): void {
    document.documentElement.setAttribute(CHASSIS_THEME_ATTRIBUTE, next);
    try {
      window.localStorage.setItem(CHASSIS_THEME_STORAGE_KEY, next);
    } catch {
      // The theme still applies for this page view; it just will not survive a reload.
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
