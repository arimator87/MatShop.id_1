import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Send } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { FavoriteButton } from "@/components/FavoriteButton";
import { RatingBadge, TopRatedBadge } from "@/components/Stars";
import { InviteDialog } from "@/components/custom/InviteDialog";
import { useAuth } from "@/context/AuthContext";

const FavCard = ({ v, onInvite }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-center" data-testid={`fav-vendor-${v.user_id}`}>
    <img src={imgSrc(v.photos[0])} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
    <div className="flex-1 min-w-0 space-y-1">
      <div className="font-heading font-semibold flex items-center gap-1.5"><span className="line-clamp-1">{v.business_name}</span><BadgeCheck className="w-4 h-4 text-green-600 shrink-0" /><TopRatedBadge show={v.top_rated} /></div>
      <RatingBadge avg={v.rating_avg} count={v.review_count} />
      <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{v.city}</div>
    </div>
    <div className="flex flex-wrap items-center gap-2 justify-end">
      <Link to={`/vendor/${v.user_id}`} data-testid={`fav-profile-${v.user_id}`} className="h-9 px-4 rounded-full border border-slate-300 text-xs font-semibold inline-flex items-center hover:border-slate-900">Lihat Profil</Link>
      <button onClick={() => onInvite(v)} data-testid={`fav-invite-${v.user_id}`} className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-amber-700"><Send className="w-3.5 h-3.5" /> Undang ke Proyek</button>
      <FavoriteButton vendorId={v.user_id} compact testid={`fav-remove-${v.user_id}`} />
    </div>
  </div>
);

export const FavoriteVendors = () => {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [inviting, setInviting] = useState(null);
  const ids = (user.favorite_vendor_ids || []).join(",");
  useEffect(() => { api.get("/favorites").then(({ data }) => setItems(data)); }, [ids]);
  if (!items) return <div className="h-32 rounded-xl bg-[#F1EFE9] animate-pulse" />;
  return (
    <div className="space-y-3" data-testid="favorite-vendors">
      {items.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl text-slate-500 space-y-3" data-testid="favorite-vendors-empty">
          <p>Belum ada vendor favorit. Simpan vendor dengan ikon hati di halaman portofolio.</p>
          <Link to="/portofolio" className="inline-flex h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold items-center">Jelajahi Portofolio</Link>
        </div>
      ) : items.map((v) => <FavCard key={v.user_id} v={v} onInvite={setInviting} />)}
      {inviting && <InviteDialog v={inviting} onClose={() => setInviting(null)} />}
    </div>
  );
};
