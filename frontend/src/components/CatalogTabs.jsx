import { TABS } from "@/lib/format";

export const CatalogTabs = ({ value, onChange }) => (
  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist">
    {TABS.map((t) => (
      <button key={t.key} role="tab" data-testid={`catalog-tab-${t.key}`} onClick={() => onChange(t.key)}
        aria-selected={value === t.key}
        className={`shrink-0 h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
          value === t.key ? "bg-[#1E242B] text-white border-[#1E242B]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
        }`}>
        {t.label}
      </button>
    ))}
  </div>
);
