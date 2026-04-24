import { useEffect } from "react";

export type Hotkey = {
  combo: string; // e.g. "mod+k", "mod+shift+p", "mod+s"
  handler: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
};

function matches(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const need = {
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    ctrl: parts.includes("ctrl"),
  };
  const key = parts.find((p) => !["mod", "shift", "alt", "ctrl"].includes(p));
  if (!key) return false;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modActive = isMac ? e.metaKey : e.ctrlKey;
  if (need.mod && !modActive) return false;
  if (!need.mod && modActive && key !== "escape") return false;
  if (need.shift !== e.shiftKey) return false;
  if (need.alt !== e.altKey) return false;
  if (need.ctrl !== (isMac ? e.ctrlKey : e.ctrlKey && !need.mod)) {
    // tolerate ctrl-as-mod on non-mac
  }
  return e.key.toLowerCase() === key;
}

export function useHotkeys(hotkeys: Hotkey[]) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      for (const hk of hotkeys) {
        if (matches(hk.combo, e)) {
          if (hk.preventDefault !== false) {
            e.preventDefault();
            e.stopPropagation();
          }
          hk.handler(e);
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys]);
}
