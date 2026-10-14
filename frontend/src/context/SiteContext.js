import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_SECTIONS, HERO_DEFAULT, IMAGE_SLOTS } from "@/lib/site";

const SiteCtx = createContext(null);

export const SiteProvider = ({ children }) => {
  const [raw, setRaw] = useState({});
  const reload = useCallback(() => api.get("/site-settings").then(({ data }) => setRaw(data || {})).catch(() => {}), []);
  useEffect(() => { reload(); }, [reload]);
  const value = useMemo(() => ({
    raw, reload,
    img: (k) => raw.images?.[k] || IMAGE_SLOTS[k].url,
    hero: { ...HERO_DEFAULT, ...(raw.hero || {}) },
    sections: raw.sections?.length ? raw.sections : DEFAULT_SECTIONS,
  }), [raw, reload]);
  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
};

export const useSite = () => useContext(SiteCtx);
