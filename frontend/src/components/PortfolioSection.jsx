import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, ExternalLink, Hammer, MapPin, PenTool } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, imgSrc } from "@/lib/api";
import { useListings } from "@/lib/useListings";
import { ListingGrid } from "@/components/ListingGrid";
import { SectionHeader } from "@/components/SectionHeader";

const ROLE = {
  supplier_vendor: { label: "Workshop / Kontraktor", icon: Hammer },
  designer_creator: { label: "Desainer / Arsitek", icon: PenTool },
};
const city = (addr) => addr.split(",").slice(-2).join(",").trim();

const PortfolioCard = ({ v, i, onOpen }) => {
  const r = ROLE[v.primary_role] || ROLE.supplier_vendor;
  return (
    <button onClick={() => onOpen(v)} data-testid={`portfolio-card-${v.user_id}`} style={{ animationDelay: `${i * 60}ms` }}
      className="fade-up group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-400 hover:-translate-y-1 transition-[transform,border-color] duration-300">
      <div className="grid grid-cols-3 grid-rows-2 gap-1 h-56">
        {[0, 1, 2].map((k) => (
          <div key={k} className={`overflow-hidden bg-[#F1EFE9] ${k === 0 ? "col-span-2 row-span-2" : ""}`}>
            {v.photos.length > 0 && <img src={imgSrc(v.photos[k % v.photos.length])} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
          </div>
        ))}
      </div>
      <div className="p-5 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-700"><r.icon className="w-3.5 h-3.5" />{r.label}</div>
        <div className="font-heading font-semibold text-lg leading-snug flex items-center gap-1.5">
          <span className="line-clamp-1">{v.business_name}</span><BadgeCheck className="w-5 h-5 text-green-600 shrink-0" />
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{city(v.address)}</div>
        <div className="text-xs text-slate-600 font-mono">{v.photos.length} foto karya · {v.completed_projects} proyek selesai · {v.listings} listing</div>
      </div>
    </button>
  );
};

const PortfolioDialog = ({ v, onClose }) => {
  const [i, setI] = useState(0);
  const { items, loading } = useListings({ owner: v.user_id, limit: 4 });
  const r = ROLE[v.primary_role] || ROLE.supplier_vendor;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="portfolio-dialog">
        <DialogHeader>
          <div className="text-[10px] font-mono uppercase tracking-widest text-amber-700 flex items-center gap-1.5"><r.icon className="w-3.5 h-3.5" />{r.label} · Terverifikasi MatShop.id</div>
          <DialogTitle className="font-heading text-2xl sm:text-3xl flex items-center gap-2">{v.business_name}<BadgeCheck className="w-6 h-6 text-green-600" /></DialogTitle>
          <DialogDescription className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{v.address}</DialogDescription>
        </DialogHeader>
        <div className="relative w-full h-64 sm:h-[420px] shrink-0 rounded-xl overflow-hidden bg-[#F1EFE9]">
          <img src={imgSrc(v.photos[i])} alt="" className="absolute inset-0 w-full h-full object-cover" data-testid="portfolio-main-photo" />
        </div>
        <div className="flex flex-wrap gap-2">
          {v.photos.map((src, k) => (
            <button key={k} onClick={() => setI(k)} data-testid={`portfolio-thumb-${k}`}
              className={`w-20 h-16 rounded-lg overflow-hidden border-2 ${k === i ? "border-amber-600" : "border-transparent"}`}>
              <img src={imgSrc(src)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/custom-project/ajukan" onClick={onClose} data-testid="portfolio-cta-request"
            className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700">
            Ajukan Proyek Custom <ArrowRight className="w-4 h-4" />
          </Link>
          <a href={v.portfolio_url} target="_blank" rel="noreferrer" data-testid="portfolio-cta-external"
            className="h-11 px-6 rounded-full border border-slate-300 font-semibold inline-flex items-center gap-2 hover:border-slate-900">
            <ExternalLink className="w-4 h-4" /> Portofolio Lengkap
          </a>
        </div>
        {(loading || items.length > 0) && (
          <div className="space-y-3 pt-2">
            <div className="font-heading font-semibold">Produk & Jasa dari {v.business_name}</div>
            <ListingGrid items={items} loading={loading} testid="portfolio-listings" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const PortfolioSection = () => {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => { api.get("/portfolios", { params: { limit: 8 } }).then(({ data }) => setItems(data)); }, []);
  if (!items.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24" data-testid="portfolio-section">
      <SectionHeader eyebrow="Portofolio Terverifikasi" title="Hasil Karya Kontraktor & Desainer MatShop" to="/custom-project" testid="portfolio-see-all" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((v, i) => <PortfolioCard key={v.user_id} v={v} i={i} onOpen={setOpen} />)}
      </div>
      {open && <PortfolioDialog v={open} onClose={() => setOpen(null)} />}
    </section>
  );
};
