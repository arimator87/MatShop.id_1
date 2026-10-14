import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Loader2, Store, User } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { rupiah, STATUS_META } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { EscrowTimeline } from "@/components/EscrowTimeline";
import { OrderActions } from "@/components/OrderActions";
import { openInvoice, ShippingInfo } from "@/components/OrderCard";

const Row = ({ label, value, cls = "", testid }) => (
  <div className={`flex justify-between text-sm ${cls}`}><span className="text-slate-600">{label}</span><span className="font-mono" data-testid={testid}>{value}</span></div>
);

const ItemsTable = ({ items }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
    <table className="w-full text-sm min-w-[640px]" data-testid="order-detail-items">
      <thead className="bg-[#F1EFE9] text-xs font-mono uppercase tracking-wider text-slate-600">
        <tr><th className="text-left p-3">Item</th><th className="text-right p-3">Qty</th><th className="text-right p-3">Eceran</th><th className="text-right p-3">Satuan</th><th className="text-right p-3">Diskon Grosir</th><th className="text-right p-3">Subtotal</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map((i) => {
          const retail = i.retail_price ?? i.unit_price;
          const disc = (retail - i.unit_price) * i.qty;
          return (
            <tr key={i.listing_id}>
              <td className="p-3"><div className="flex items-center gap-3"><img src={imgSrc(i.image)} alt="" className="w-10 h-10 rounded object-cover" /><span className="font-medium">{i.title}</span>{i.is_wholesale && <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">Grosir</span>}</div></td>
              <td className="p-3 text-right font-mono">{i.qty} {i.unit}</td>
              <td className="p-3 text-right font-mono">{rupiah(retail)}</td>
              <td className="p-3 text-right font-mono">{rupiah(i.unit_price)}</td>
              <td className="p-3 text-right font-mono text-green-700">{disc > 0 ? `-${rupiah(disc)}` : "—"}</td>
              <td className="p-3 text-right font-mono">{rupiah(i.subtotal)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default function OrderDetail() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const [o, setO] = useState(null);
  const load = useCallback(() => api.get(`/orders/${orderId}`).then(({ data }) => setO(data)).catch(() => setO(false)), [orderId]);
  useEffect(() => { load(); }, [load]);

  if (o === false) return <div className="py-32 text-center" data-testid="order-not-found">Pesanan tidak ditemukan.</div>;
  if (!o) return <div className="py-32 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const isBuyer = o.buyer_id === user.user_id;
  const st = STATUS_META[o.status];
  const itemsTotal = o.items_total ?? o.items.reduce((s, i) => s + i.subtotal, 0);
  const savings = o.items.reduce((s, i) => s + ((i.retail_price ?? i.unit_price) - i.unit_price) * i.qty, 0);
  const fee = o.service_fee || 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8" data-testid="order-detail-page">
      <Link to={isBuyer ? "/pesanan" : "/dashboard"} className="text-sm text-slate-600 inline-flex items-center gap-1 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Kembali</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">Detail Pesanan</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-mono">{o.order_id}</h1>
          <span className={`inline-block mt-3 text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`} data-testid="order-detail-status"><span className="font-mono">{st.code}</span> · {st.label}</span>
        </div>
        <button data-testid="print-invoice-button" disabled={o.status === "awaiting_payment"} onClick={() => openInvoice(o.order_id)}
          className="h-11 px-6 rounded-full bg-[#1E242B] text-white font-semibold inline-flex items-center gap-2 hover:bg-slate-800 disabled:opacity-40">
          <FileDown className="w-4 h-4" /> Cetak Invoice PDF
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5"><EscrowTimeline status={o.status} preDispute={o.pre_dispute_status} /></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1 text-sm" data-testid="order-detail-vendor">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2"><Store className="w-3.5 h-3.5" /> Data Vendor</div>
          <div className="font-semibold">{o.seller_name}</div>
          {o.warehouse_location && <div className="text-slate-600">Gudang: {o.warehouse_location}</div>}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1 text-sm">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2"><User className="w-3.5 h-3.5" /> Penerima</div>
          <div className="font-semibold">{o.shipping?.recipient}</div>
          <div className="text-slate-600">{o.shipping?.phone} · {o.shipping?.address}</div>
        </div>
      </div>
      <ItemsTable items={o.items} />
      <ShippingInfo o={o} />
      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="space-y-2 text-sm" data-testid="order-detail-history">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2">Riwayat</div>
          {o.timeline.map((t, k) => (
            <div key={k} className="flex gap-3"><span className="font-mono text-xs text-slate-400 w-28 shrink-0">{new Date(t.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span><span>{t.note}</span></div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <Row label="Subtotal item" value={rupiah(itemsTotal)} />
          {savings > 0 && <Row label="Hemat harga grosir" value={`-${rupiah(savings)}`} cls="text-green-700" testid="order-detail-savings" />}
          <Row label="Estimasi ongkos kirim" value={rupiah(o.shipping_cost || 0)} testid="order-detail-shipping-cost" />
          <Row label="Biaya layanan escrow" value={rupiah(fee)} />
          <div className="flex justify-between items-baseline border-t border-dashed pt-3"><span className="font-medium">Total tagihan</span><span className="font-heading text-2xl font-bold" data-testid="order-detail-total">{rupiah(o.total + fee)}</span></div>
          {isBuyer && <div className="flex flex-wrap gap-2 pt-2"><OrderActions o={o} onChange={load} /></div>}
        </div>
      </div>
    </div>
  );
}
