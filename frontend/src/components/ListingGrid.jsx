import { ListingCard } from "@/components/ListingCard";
import { mixAds, SponsoredCard, useAds } from "@/components/promo/Sponsored";

export const ListingGrid = ({ items, loading, testid = "listing-grid", adPlacement, maxCards, adEvery = 4 }) => {
  const ads = useAds(adPlacement);
  if (loading)
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 sm:h-80 rounded-xl bg-[#F1EFE9] animate-pulse" />
        ))}
      </div>
    );
  if (!items.length)
    return <div data-testid={`${testid}-empty`} className="py-16 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl">Belum ada item.</div>;
  return (
    <div data-testid={testid} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      {mixAds(items, ads, adEvery).slice(0, maxCards).map((x) => (x.kind === "ad"
        ? <SponsoredCard key={x.ad.ad_id} ad={x.ad} />
        : <ListingCard key={x.l.listing_id} l={x.l} i={x.i} />))}
    </div>
  );
};
