import { Link } from "react-router-dom";
import { Clock, Download, Star, Tag } from "lucide-react";
import { imgSrc } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { Watermark } from "@/components/Watermark";

const Meta = ({ l }) => {
  if (l.type === "material" && l.tiers?.length) {
    const t = l.tiers[0];
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-md px-2 py-1 w-fit">
        <Tag className="w-3 h-3" /> Grosir ≥{t.min_qty}: <b>{rupiah(t.price)}</b>
      </div>
    );
  }
  if (l.type === "service")
    return <div className="flex items-center gap-1.5 text-xs text-slate-600"><Clock className="w-3 h-3" /> {l.delivery_days} hari · {l.revisions}x revisi</div>;
  if (l.type === "asset")
    return <div className="flex items-center gap-1.5 text-xs text-blue-700"><Download className="w-3 h-3" /> Unduh instan · {l.file_size}</div>;
  return null;
};

export const ListingCard = ({ l, i = 0 }) => (
  <Link to={`/item/${l.listing_id}`} data-testid={`listing-card-${l.listing_id}`}
    style={{ animationDelay: `${i * 50}ms` }}
    className="fade-up group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-400 hover:-translate-y-1 transition-[transform,border-color,box-shadow] duration-300 hover:shadow-[0_12px_40px_-16px_rgba(30,36,43,0.35)] flex flex-col">
    <div className="relative aspect-[4/3] bg-[#F1EFE9] overflow-hidden">
      <img src={imgSrc(l.images?.[0])} alt={l.title} loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      {l.type !== "material" && <Watermark small />}
      <span className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider bg-white/90 backdrop-blur px-2 py-1 rounded">
        {l.category_label}
      </span>
      {l.type === "asset" && (
        <span className="absolute top-3 right-3 text-[10px] font-mono font-semibold bg-[#1E242B] text-white px-2 py-1 rounded">{l.file_format}</span>
      )}
    </div>
    <div className="p-4 flex flex-col gap-2 flex-1">
      <h3 className="font-heading font-semibold text-slate-900 leading-snug line-clamp-2">{l.title}</h3>
      <div className="text-xs text-slate-500 flex items-center gap-2">
        <span className="truncate">{l.owner_name}</span>
        {l.rating > 0 && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-500 text-amber-500" />{l.rating}</span>}
        <span>· {l.sold} terjual</span>
      </div>
      <Meta l={l} />
      <div className="mt-auto pt-2 flex items-baseline gap-1">
        <span className="font-heading text-lg font-bold text-slate-900" data-testid="listing-card-price">{rupiah(l.price)}</span>
        <span className="text-xs text-slate-500">/ {l.unit}</span>
      </div>
    </div>
  </Link>
);
