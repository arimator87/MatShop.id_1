import { useNavigate } from "react-router-dom";
import { ArrowUpRight, BadgeCheck, Megaphone } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { openLink } from "@/components/promo/PromoPopup";
import { adTarget, useAds } from "@/components/promo/Sponsored";
import { RatingBadge, TopRatedBadge } from "@/components/Stars";

export const AdStrip = ({ placement, slot = 0, testid, cls = "" }) => {
  const ads = useAds(placement);
  const nav = useNavigate();
  if (slot >= ads.length) return null;
  const ad = ads[slot];
  const target = adTarget(ad);
  const click = () => { if (!target) return; api.post(`/ads/${ad.ad_id}/click`).catch(() => {}); openLink(target, nav); };
  const Tag = target ? "button" : "div";
  return (
    <Tag onClick={target ? click : undefined} data-testid={testid || `ad-strip-${placement}-${slot}`} data-ad-id={ad.ad_id} data-clickable={!!target}
      className={`group w-full text-left grid grid-cols-1 sm:grid-cols-[minmax(0,320px)_1fr] bg-white rounded-2xl border border-amber-300 overflow-hidden hover:border-amber-500 transition-colors ${cls}`}>
      <div className="aspect-[4/3] sm:aspect-auto sm:h-full min-h-[160px] bg-[#F1EFE9] overflow-hidden">
        <img src={imgSrc(ad.image)} alt={ad.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="p-5 sm:p-8 flex flex-col justify-center gap-2 min-w-0">
        <span className="w-fit text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-500 text-[#1E242B] px-2 py-1 rounded inline-flex items-center gap-1"><Megaphone className="w-3 h-3" /> Sponsor</span>
        <div className="text-sm text-amber-700 font-medium flex items-center gap-1">{ad.advertiser}{ad.vendor && <BadgeCheck className="w-4 h-4 text-green-600" />}</div>
        <h3 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{ad.title}</h3>
        {ad.vendor && <div className="flex flex-wrap items-center gap-2"><TopRatedBadge show={ad.vendor.top_rated} /><RatingBadge avg={ad.vendor.rating} count={ad.vendor.review_count} /></div>}
        {ad.description && <p className="text-sm text-slate-600 max-w-2xl">{ad.description}</p>}
        {target && <span className="mt-2 w-fit h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5 group-hover:bg-amber-600 transition-colors">{ad.cta || "Lihat Promo"} <ArrowUpRight className="w-4 h-4" /></span>}
      </div>
    </Tag>
  );
};
