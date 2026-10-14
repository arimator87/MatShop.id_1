import { useEffect, useState } from "react";
import { api, imgSrc } from "@/lib/api";

let cache = null;

export const useCatalogTabs = () => {
  const [tabs, setTabs] = useState(cache || []);
  useEffect(() => {
    if (!cache) api.get("/catalog/tabs").then(({ data }) => { cache = data; setTabs(data); }).catch(() => {});
  }, []);
  return tabs;
};

export const resetCatalogTabs = () => { cache = null; };

export const CatalogTabs = ({ value, onChange }) => {
  const tabs = useCatalogTabs();
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" data-testid={`catalog-tab-${t.key}`} onClick={() => onChange(t.key)}
          aria-selected={value === t.key}
          className={`shrink-0 h-10 rounded-full text-sm font-medium border transition-colors inline-flex items-center gap-2 ${t.icon ? "pl-1.5 pr-4" : "px-4"} ${
            value === t.key ? "bg-[#1E242B] text-white border-[#1E242B]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          }`}>
          {t.icon && <img src={imgSrc(t.icon)} alt="" className="w-7 h-7 rounded-full object-cover bg-[#F1EFE9]" data-testid={`catalog-tab-icon-${t.key}`} />}
          {t.label}
        </button>
      ))}
    </div>
  );
};
