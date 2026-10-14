import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { rupiah, SERVICE_FEE } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { EscrowTimeline } from "@/components/EscrowTimeline";
import { cargoEstimate, groupBySeller, ShippingPicker } from "@/components/ShippingPicker";

const Field = ({ label, ...p }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input {...p} className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 transition-colors" />
  </label>
);

export default function Checkout() {
  const { user } = useAuth();
  const { cart, loaded, refresh } = useCart();
  const navigate = useNavigate();
  const [f, setF] = useState({ recipient: user.name, phone: "", address: "", notes: "" });
  const [shipping, setShipping] = useState({});
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const groups = useMemo(() => groupBySeller(cart.items), [cart.items]);
  const matGroups = Object.entries(groups).filter(([, g]) => g.items.some((i) => i.listing.type === "material"));
  const methodOf = (id) => shipping[id] || "vendor_cargo";
  const shipTotal = matGroups.reduce((s, [id, g]) => s + (methodOf(id) === "vendor_cargo" ? cargoEstimate(g.items) : 0), 0);
  const fees = SERVICE_FEE * Object.keys(groups).length;

  if (!loaded) return <div className="min-h-[50vh]" data-testid="checkout-loading" />;
  if (cart.items.length === 0 && !busy) return <Navigate to="/keranjang" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ship = Object.fromEntries(matGroups.map(([id]) => [id, methodOf(id)]));
      const { data } = await api.post("/checkout", { ...f, shipping: ship });
      navigate(`/bayar/${data.payment_id}`);
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid lg:grid-cols-12 gap-8" data-testid="checkout-page">
      <div className="lg:col-span-7 space-y-8">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Checkout</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-heading font-semibold text-lg">Alamat Pengiriman / Proyek</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nama penerima" required value={f.recipient} onChange={on("recipient")} data-testid="checkout-recipient-input" />
            <Field label="No. HP" required value={f.phone} onChange={on("phone")} data-testid="checkout-phone-input" placeholder="08xxxxxxxxxx" />
          </div>
          <Field label="Alamat lengkap proyek" required value={f.address} onChange={on("address")} data-testid="checkout-address-input" placeholder="Jl. ..., Kota" />
          <Field label="Catatan (opsional)" value={f.notes} onChange={on("notes")} data-testid="checkout-notes-input" placeholder="Brief desain / jadwal pengiriman" />
        </div>
        {matGroups.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5" data-testid="checkout-shipping-section">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><Truck className="w-5 h-5 text-amber-600" /> Pengiriman Material Fisik</h2>
            {matGroups.map(([id, g]) => (
              <ShippingPicker key={id} sellerId={id} group={g} value={methodOf(id)} onChange={(v) => setShipping({ ...shipping, [id]: v })} />
            ))}
            <p className="text-xs text-slate-500">Estimasi ongkir = biaya dasar armada {rupiah(50000)} + tarif kargo per unit dari vendor. Aset digital & jasa tidak memerlukan pengiriman.</p>
          </div>
        )}
        <div className="bg-[#1E242B] text-white rounded-xl p-6 space-y-5 blueprint-grid-dark">
          <div className="flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-amber-500" /><h2 className="font-heading font-semibold text-lg">Alur Escrow Payment</h2></div>
          <div className="bg-white rounded-lg p-4"><EscrowTimeline status="held" /></div>
          <p className="text-sm text-slate-300">Dana ditahan sistem MatShop.id dan hanya dirilis setelah Anda konfirmasi. Ada masalah? Ajukan komplain dan dana dibekukan hingga mediasi selesai.</p>
        </div>
      </div>
      <aside className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4 h-fit lg:sticky lg:top-24">
        <h2 className="font-heading font-semibold text-lg">Ringkasan Pesanan</h2>
        <div className="divide-y divide-slate-100 max-h-80 overflow-auto">
          {cart.items.map((it) => (
            <div key={it.listing.listing_id} className="py-3 flex justify-between gap-3 text-sm">
              <span className="line-clamp-2">{it.listing.title} <span className="text-slate-500 font-mono">×{it.qty}</span></span>
              <span className="font-mono shrink-0">{rupiah(it.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal</span><span className="font-mono">{rupiah(cart.total)}</span></div>
        {matGroups.length > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Estimasi ongkos kirim</span><span className="font-mono" data-testid="checkout-shipping-total">{rupiah(shipTotal)}</span></div>}
        <div className="flex justify-between text-sm"><span className="text-slate-600">Biaya layanan escrow ({Object.keys(groups).length} vendor)</span><span className="font-mono">{rupiah(fees)}</span></div>
        <div className="flex justify-between items-baseline border-t border-dashed pt-4"><span className="font-medium">Total Bayar</span><span className="font-heading text-2xl font-bold" data-testid="checkout-grand-total">{rupiah(cart.total + shipTotal + fees)}</span></div>
        <button type="submit" disabled={busy} data-testid="checkout-submit-button"
          className="h-12 w-full rounded-full bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Buat Pesanan & Bayar
        </button>
      </aside>
    </form>
  );
}
