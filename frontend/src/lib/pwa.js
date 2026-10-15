import { useEffect, useReducer } from "react";

const state = { deferred: null, guide: false };
const subs = new Set();
const emit = () => subs.forEach((f) => f());

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); state.deferred = e; emit(); });
window.addEventListener("appinstalled", () => { state.deferred = null; emit(); });

export const registerSW = () => {
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
};

export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const setGuide = (v) => { state.guide = v; emit(); };

export const installApp = async () => {
  if (!state.deferred) return setGuide(true);
  const e = state.deferred;
  e.prompt();
  await e.userChoice.catch(() => null);
  state.deferred = null;
  emit();
};

export const usePWA = () => {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => { subs.add(force); return () => { subs.delete(force); }; }, []);
  return { canPrompt: !!state.deferred, guide: state.guide, standalone: isStandalone() };
};
