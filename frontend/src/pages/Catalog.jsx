import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { CatalogTabs } from "@/components/CatalogTabs";
import { ListingGrid } from "@/components/ListingGrid";
import { useListings } from "@/lib/useListings";

const SORTS = [
  ["popular", "Terlaris"], ["newest", "Terbaru"], ["price_asc", "Harga Terendah"], ["price_desc", "Harga Tertinggi"],
];

export default function Catalog() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "";
  const q = sp.get("q") || "";
  const sort = sp.get("sort") || "popular";
  const { items, loading } = useListings({ tab, q, sort });
  const set = (k, v) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="catalog-page">
      <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">Katalog</div>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8">{q ? `Hasil untuk “${q}”` : "Katalog MatShop.id"}</h1>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
        <div className="flex-1 min-w-0"><CatalogTabs value={tab} onChange={(v) => setSp({ tab: v, sort })} /></div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 h-10 px-3 rounded-full bg-white border border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input data-testid="catalog-search-input" defaultValue={q} placeholder="Cari..."
              onKeyDown={(e) => e.key === "Enter" && set("q", e.target.value)}
              className="outline-none text-sm w-32 sm:w-44 bg-transparent" />
          </label>
          <select data-testid="catalog-sort-select" value={sort} onChange={(e) => set("sort", e.target.value)}
            className="h-10 px-3 rounded-full bg-white border border-slate-200 text-sm">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="text-sm text-slate-500 mb-4 font-mono" data-testid="catalog-count">{loading ? "Memuat..." : `${items.length} item`}</div>
      <ListingGrid items={items} loading={loading} testid="catalog-grid" />
    </div>
  );
}
