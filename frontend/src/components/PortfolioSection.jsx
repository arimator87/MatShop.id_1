import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { roleOf, WORK_TYPES } from "@/lib/vendor";
import { SectionHeader } from "@/components/SectionHeader";
import { RatingBadge } from "@/components/Stars";

const selCls = "h-10 px-3 rounded-full border border-slate-300 bg-white text-sm outline-none focus:border-amber-600";

const PortfolioCard = ({ v, i }) => {
  const r = roleOf(v.primary_role);
  return (
    <Link to={`/vendor/${v.user_id}`} data-testid={`portfolio-card-${v.user_id}`} style={{ animationDelay: `${i * 60}ms` }}
      className="fade-up group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-400 hover:-translate-y-1 transition-[transform,border-color] duration-300">
      <div className="grid grid-cols-3 grid-rows-2 gap-1 h-56">
        {[0, 1, 2].map((k) => (
          <div key={k} className={`overflow-hidden bg-[#F1EFE9] ${k === 0 ? "col-span-2 row-span-2" : ""}`}>
            <img src={imgSrc(v.photos[k % v.photos.length])} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
        ))}
      </div>
      <div className="p-5 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-700"><r.icon className="w-3.5 h-3.5" />{r.label}</div>
        <div className="font-heading font-semibold text-lg leading-snug flex items-center gap-1.5">
          <span className="line-clamp-1">{v.business_name}</span><BadgeCheck className="w-5 h-5 text-green-600 shrink-0" />
        </div>
        <RatingBadge avg={v.rating_avg} count={v.review_count} testid={`portfolio-rating-${v.user_id}`} />
        <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{v.city}</div>
        <div className="flex flex-wrap gap-1">
          {v.work_types.slice(0, 3).map((w) => <span key={w} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1EFE9] text-slate-700">{WORK_TYPES[w]}</span>)}
        </div>
      </div>
    </Link>
  );
};

const Filters = ({ q, setQ, cities }) => {
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  return (
    <div className="flex flex-wrap gap-3 mb-8" data-testid="portfolio-filters">
      <select value={q.city} onChange={set("city")} className={selCls} data-testid="portfolio-filter-city">
        <option value="">Semua Kota</option>
        {cities.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={q.work_type} onChange={set("work_type")} className={selCls} data-testid="portfolio-filter-work-type">
        <option value="">Semua Jenis Pekerjaan</option>
        {Object.entries(WORK_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <select value={q.sort} onChange={set("sort")} className={selCls} data-testid="portfolio-sort">
        <option value="featured">Unggulan</option>
        <option value="rating">Rating Tertinggi</option>
      </select>
    </div>
  );
};

export const PortfolioSection = ({ limit = 8, full = false }) => {
  const [items, setItems] = useState(null);
  const [cities, setCities] = useState([]);
  const [q, setQ] = useState({ city: "", work_type: "", sort: "featured" });
  useEffect(() => { api.get("/portfolios/filters").then(({ data }) => setCities(data.cities)); }, []);
  useEffect(() => {
    const params = Object.fromEntries(Object.entries({ ...q, limit }).filter(([, v]) => v));
    api.get("/portfolios", { params }).then(({ data }) => setItems(data));
  }, [q, limit]);
  if (items === null) return null;
  return (
    <section className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${full ? "py-12" : "pt-24"}`} data-testid="portfolio-section">
      <SectionHeader eyebrow="Portofolio Terverifikasi" title="Hasil Karya Kontraktor & Desainer MatShop" to={full ? null : "/portofolio"} testid="portfolio-see-all" />
      <Filters q={q} setQ={setQ} cities={cities} />
      {items.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="portfolio-grid">
          {items.map((v, i) => <PortfolioCard key={v.user_id} v={v} i={i} />)}
        </div>
      ) : (
        <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid="portfolio-empty">Belum ada vendor untuk filter ini.</div>
      )}
    </section>
  );
};
