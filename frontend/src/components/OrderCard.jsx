import { Link } from "react-router-dom";
import { Download, ExternalLink, FileText, Lock, ShieldAlert, Truck, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { api, BACKEND, errMsg, imgSrc } from "@/lib/api";
import { rupiah, SHIP_METHODS, STATUS_META } from "@/lib/format";
import { EscrowTimeline } from "@/components/EscrowTimeline";

export const downloadAsset = async (orderId, listingId) => {
  try {
    const { data } = await api.get(`/orders/${orderId}/download/${listingId}`);
    window.open(data.file_url, "_blank", "noopener");
    toast.success(`Mengunduh ${data.title}`);
  } catch (e) {
    toast.error(errMsg(e));
  }
};

export const openInvoice = (orderId) => window.open(`${BACKEND}/api/orders/${orderId}/invoice.pdf`, "_blank");

const AssetAction = ({ o, it }) =>
  o.status === "released" ? (
    <button data-testid={`download-asset-${o.order_id}-${it.listing_id}`} onClick={() => downloadAsset(o.order_id, it.listing_id)}
      className="h-9 px-4 rounded-full bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-blue-700">
      <Download className="w-3.5 h-3.5" /> Unduh File Asli
    </button>
  ) : (
    <span data-testid={`asset-locked-${o.order_id}-${it.listing_id}`} className="text-[11px] text-slate-500 inline-flex items-center gap-1 bg-slate-100 rounded-full px-3 py-1.5">
      <Lock className="w-3 h-3" /> Terbuka setelah COMPLETED
    </span>
  );

export const ShippingInfo = ({ o }) => {
  if (!o.shipping_method) return null;
  const pickup = o.shipping_method === "pickup";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 bg-[#F8F7F4] border border-slate-200 rounded-md px-3 py-2" data-testid={`order-shipping-${o.order_id}`}>
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
        {pickup ? <Warehouse className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}{SHIP_METHODS[o.shipping_method]}
      </span>
      {pickup ? <span>Lokasi: {o.warehouse_location || "-"}</span> : <span>Estimasi ongkir: <b className="font-mono">{rupiah(o.shipping_cost)}</b></span>}
    </div>
  );
};

export const DisputeInfo = ({ o }) => {
  const d = o.dispute;
  const resolved = d.status === "resolved";
  return (
    <div className={`text-xs rounded-md p-3 space-y-2 ${resolved ? "bg-slate-50 text-slate-700 border border-slate-200" : "bg-red-50 text-red-800"}`} data-testid={`order-dispute-reason-${o.order_id}`}>
      <div className="flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /> Komplain buyer: {d.reason}{d.status === "withdrawn" && " (dibatalkan)"}</div>
      {d.evidence?.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid={`order-dispute-evidence-${o.order_id}`}>
          {d.evidence.map((src, i) => (
            <a key={i} href={imgSrc(src)} target="_blank" rel="noreferrer"><img src={imgSrc(src)} alt="bukti" className="w-16 h-16 rounded object-cover border" /></a>
          ))}
        </div>
      )}
      {resolved && (
        <div data-testid={`order-dispute-resolution-${o.order_id}`}>
          <b>Keputusan mediasi:</b> {d.decision === "refund_buyer" ? "Refund ke buyer" : "Dana dirilis ke vendor"} · {d.admin_note}
        </div>
      )}
    </div>
  );
};

export const OrderCard = ({ o, actions, asBuyer = true }) => {
  const st = STATUS_META[o.status];
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid={`order-card-${o.order_id}`}>
      <div className="px-5 py-3 bg-[#F1EFE9] flex flex-wrap items-center gap-3 justify-between">
        <div className="text-sm"><span className="font-mono font-semibold">{o.order_id}</span>
          <span className="text-slate-500"> · {asBuyer ? o.seller_name : o.buyer_name} · {new Date(o.created_at).toLocaleDateString("id-ID")}</span></div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`} data-testid={`order-status-${o.order_id}`}>
          <span className="font-mono mr-1">{st.code}</span>· {st.label}
        </span>
      </div>
      <div className="p-5 space-y-4">
        <EscrowTimeline status={o.status} preDispute={o.pre_dispute_status} />
        <div className="divide-y divide-slate-100">
          {o.items.map((it) => (
            <div key={it.listing_id} className="py-3 flex flex-wrap items-center gap-3">
              <img src={imgSrc(it.image)} alt="" className="w-14 h-14 rounded-lg object-cover" />
              <div className="flex-1 min-w-[160px]">
                <Link to={`/item/${it.listing_id}`} className="text-sm font-medium line-clamp-1 hover:text-amber-700">{it.title}</Link>
                <div className="text-xs text-slate-500 font-mono">{it.qty} {it.unit} × {rupiah(it.unit_price)}{it.is_wholesale && " · grosir"}</div>
              </div>
              {asBuyer && it.type === "asset" && o.status !== "awaiting_payment" && <AssetAction o={o} it={it} />}
              <div className="font-mono text-sm w-28 text-right">{rupiah(it.subtotal)}</div>
            </div>
          ))}
        </div>
        <ShippingInfo o={o} />
        {o.dispute && <DisputeInfo o={o} />}
        {o.seller_note && <div className="text-xs bg-blue-50 text-blue-800 rounded-md p-3" data-testid={`order-note-${o.order_id}`}>Catatan penjual: {o.seller_note}</div>}
        {o.deliverable_url && (
          <a href={o.deliverable_url} target="_blank" rel="noreferrer" data-testid={`order-deliverable-${o.order_id}`}
            className="text-xs inline-flex items-center gap-1.5 text-blue-700 font-semibold hover:underline"><ExternalLink className="w-3.5 h-3.5" /> File hasil jasa (asli)</a>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-dashed">
          <div className="text-sm">Total <span className="font-heading text-lg font-bold ml-1">{rupiah(o.total)}</span></div>
          <div className="flex flex-wrap gap-2">
            {actions}
            <Link to={`/pesanan/${o.order_id}`} data-testid={`order-detail-link-${o.order_id}`}
              className="h-10 px-4 rounded-full border border-slate-300 text-sm font-semibold inline-flex items-center gap-1.5 hover:border-slate-900">
              <FileText className="w-4 h-4" /> Detail & Invoice
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
