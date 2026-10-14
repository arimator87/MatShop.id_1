import { ListingCard } from "@/components/ListingCard";

export const ListingGrid = ({ items, loading, testid = "listing-grid" }) => {
  if (loading)
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-80 rounded-xl bg-[#F1EFE9] animate-pulse" />
        ))}
      </div>
    );
  if (!items.length)
    return <div data-testid={`${testid}-empty`} className="py-16 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl">Belum ada item.</div>;
  return (
    <div data-testid={testid} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((l, i) => <ListingCard key={l.listing_id} l={l} i={i} />)}
    </div>
  );
};
