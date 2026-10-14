import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { openLink } from "@/components/promo/PromoPopup";

export const useAds = (placement) => {
  const [ads, setAds] = useState([]);
  useEffect(() => {
    if (placement) api.get("/ads", { params: { placement } }).then(({ data }) => setAds(data)).catch(() => {});
  }, [placement]);
  return ads;
};

export const SponsoredCard = ({ ad }) => {
  const nav = useNavigate();
  const click = () => { api.post(`/ads/${ad.ad_id}/click`).catch(() => {}); openLink(ad.link_url, nav); };
  return (
    <button onClick={click} data-testid={`sponsored-card-${ad.ad_id}`}
      className="fade-up group text-left bg-white rounded-xl border border-amber-300 overflow-hidden hover:border-amber-500 hover:-translate-y-1 transition-[transform,border-color] duration-300 flex flex-col">
      <div className="relative aspect-[4/3] bg-[#F1EFE9] overflow-hidden">
        <img src={imgSrc(ad.image)} alt={ad.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute top-2 left-2 sm:top-3 sm:left-3 text-[9px] sm:text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-500 text-[#1E242B] px-2 py-1 rounded inline-flex items-center gap-1">
          <Megaphone className="w-3 h-3" /> Sponsor
        </span>
      </div>
      <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="text-[11px] sm:text-xs text-amber-700 font-medium truncate">{ad.advertiser}</div>
        <h3 className="font-heading font-semibold text-sm sm:text-base text-slate-900 leading-snug line-clamp-2">{ad.title}</h3>
        {ad.description && <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2">{ad.description}</p>}
        <span className="mt-auto pt-1 text-xs sm:text-sm font-semibold text-slate-900 inline-flex items-center gap-1 group-hover:text-amber-700">{ad.cta || "Lihat Promo"} <ArrowUpRight className="w-4 h-4" /></span>
      </div>
    </button>
  );
};

export const mixAds = (items, ads, every = 4) => {
  const out = [];
  let a = 0;
  items.forEach((l, i) => {
    out.push({ kind: "item", l, i });
    if ((i + 1) % every === 0 && a < ads.length) out.push({ kind: "ad", ad: ads[a++] });
  });
  if (items.length && items.length < every && ads.length) out.push({ kind: "ad", ad: ads[0] });
  return out;
};
