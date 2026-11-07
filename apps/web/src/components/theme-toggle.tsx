"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "wd-theme";

/** Runs before first paint (inlined in <head>): dark unless the visitor picked light. */
export const themeInitScript = `try{if(localStorage.getItem("${KEY}")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Light/dark switch, like Designeer's. The choice is remembered in this browser only. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => true,
  );
  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem(KEY, next ? "dark" : "light");
        } catch {
          // Private mode or blocked storage: the switch still works for this page view.
        }
      }}
      className="wd-spring inline-flex size-8 items-center justify-center rounded-full border border-line-2 text-muted-ink hover:bg-hover hover:text-ink"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
