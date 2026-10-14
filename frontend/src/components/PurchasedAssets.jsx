import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileBox, Lock } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { downloadAsset } from "@/components/OrderCard";

export const PurchasedAssets = () => {
  const [assets, setAssets] = useState(null);
  useEffect(() => {
    api.get("/orders", { params: { role: "buyer" } }).then(({ data }) => setAssets(
      data.filter((o) => o.status !== "awaiting_payment")
        .flatMap((o) => o.items.filter((i) => i.type === "asset").map((i) => ({ ...i, order_id: o.order_id, created_at: o.created_at, status: o.status })))
    ));
  }, []);

  if (!assets) return <div className="h-40 rounded-xl bg-[#F1EFE9] animate-pulse" />;
  if (!assets.length)
    return (
      <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl space-y-3" data-testid="purchased-assets-empty">
        <FileBox className="w-10 h-10 mx-auto text-slate-400" />
        <p className="text-slate-600">Belum ada aset digital yang dibeli.</p>
        <Link to="/katalog?tab=assets" className="text-sm font-semibold text-amber-700 hover:underline">Jelajahi Aset File 3D</Link>
      </div>
    );
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="purchased-assets-list">
      {assets.map((a) => (
        <div key={`${a.order_id}-${a.listing_id}`} data-testid={`purchased-asset-${a.listing_id}`}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <img src={imgSrc(a.image)} alt="" className="aspect-[16/9] w-full object-cover bg-[#F1EFE9]" />
          <div className="p-4 flex flex-col gap-2 flex-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{a.order_id} · {new Date(a.created_at).toLocaleDateString("id-ID")}</div>
            <div className="font-heading font-semibold leading-snug line-clamp-2">{a.title}</div>
            <div className="text-sm text-slate-600 font-mono">{rupiah(a.subtotal)}</div>
            {a.status === "released" ? (
              <button data-testid={`purchased-download-${a.listing_id}`} onClick={() => downloadAsset(a.order_id, a.listing_id)}
                className="mt-auto h-10 rounded-full bg-blue-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" /> Unduh File Asli
              </button>
            ) : (
              <Link to={`/pesanan/${a.order_id}`} data-testid={`purchased-locked-${a.listing_id}`}
                className="mt-auto h-10 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-200">
                <Lock className="w-3.5 h-3.5" /> Konfirmasi pesanan (COMPLETED) untuk unduh
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
