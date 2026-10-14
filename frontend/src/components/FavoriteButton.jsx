import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const FavoriteButton = ({ vendorId, compact = false, testid }) => {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  if (user?.user_id === vendorId) return null;
  const fav = !!user?.favorite_vendor_ids?.includes(vendorId);
  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return nav("/login");
    try {
      const { data } = await api.post(`/favorites/${vendorId}`);
      setUser({ ...user, favorite_vendor_ids: data.favorite_vendor_ids });
      toast.success(data.favorite ? "Disimpan ke Vendor Favorit" : "Dihapus dari Vendor Favorit");
    } catch (err) { toast.error(errMsg(err)); }
  };
  const icon = <Heart className={`w-4 h-4 transition-colors ${fav ? "fill-red-500 text-red-500" : ""}`} />;
  if (compact) return (
    <button onClick={toggle} data-testid={testid} data-favorite={fav} aria-label="Simpan vendor"
      className="w-9 h-9 rounded-full bg-white/95 backdrop-blur grid place-items-center shadow-sm hover:scale-110 transition-transform">{icon}</button>
  );
  return (
    <button onClick={toggle} data-testid={testid} data-favorite={fav}
      className="h-12 px-6 rounded-full border border-slate-300 font-semibold inline-flex items-center gap-2 hover:border-slate-900">
      {icon} {fav ? "Tersimpan" : "Simpan"}
    </button>
  );
};
