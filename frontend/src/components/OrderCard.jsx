import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, imgSrc } from "@/lib/api";
import { rupiah, STATUS_META } from "@/lib/format";
import { EscrowTimeline } from "@/components/EscrowTimeline";

const downloadAsset = async (orderId, listingId) => {
  try {
    const { data } = await api.get(`/orders/${orderId}/download/${listingId}`);
    window.open(data.file_url, "_blank", "noopener");
    toast.success(`Mengunduh ${data.title}`);
  } catch (e) {
    toast.error(errMsg(e));
  }
};

export const OrderCard = ({ o, actions, asBuyer = true }) => {
  const st = STATUS_META[o.status];
  const paid = o.status !== "awaiting_payment";
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid={`order-card-${o.order_id}`}>
      <div className="px-5 py-3 bg-[#F1EFE9] flex flex-wrap items-center gap-3 justify-between">
        <div className="text-sm"><span className="font-mono font-semibold">{o.order_id}</span>
          <span className="text-slate-500"> · {asBuyer ? o.seller_name : o.buyer_name} · {new Date(o.created_at).toLocaleDateString("id-ID")}</span></div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`} data-testid={`order-status-${o.order_id}`}>{st.label}</span>
      </div>
      <div className="p-5 space-y-5">
        <EscrowTimeline status={o.status} />
        <div className="divide-y divide-slate-100">
          {o.items.map((it) => (
            <div key={it.listing_id} className="py-3 flex items-center gap-3">
              <img src={imgSrc(it.image)} alt="" className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <Link to={`/item/${it.listing_id}`} className="text-sm font-medium line-clamp-1 hover:text-amber-700">{it.title}</Link>
                <div className="text-xs text-slate-500 font-mono">{it.qty} {it.unit} × {rupiah(it.unit_price)}{it.is_wholesale && " · grosir"}</div>
              </div>
              {asBuyer && it.type === "asset" && paid && (
                <button data-testid={`download-asset-${o.order_id}-${it.listing_id}`} onClick={() => downloadAsset(o.order_id, it.listing_id)}
                  className="h-9 px-4 rounded-full bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-blue-700">
                  <Download className="w-3.5 h-3.5" /> Unduh
                </button>
              )}
              <div className="font-mono text-sm w-28 text-right">{rupiah(it.subtotal)}</div>
            </div>
          ))}
        </div>
        {o.seller_note && <div className="text-xs bg-blue-50 text-blue-800 rounded-md p-3" data-testid={`order-note-${o.order_id}`}>Catatan penjual: {o.seller_note}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-dashed">
          <div className="text-sm">Total <span className="font-heading text-lg font-bold ml-1">{rupiah(o.total)}</span></div>
          <div className="flex gap-2">{actions}</div>
        </div>
      </div>
    </div>
  );
};
