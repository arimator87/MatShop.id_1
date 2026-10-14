import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { imgSrc } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useCart } from "@/context/CartContext";

const CartRow = ({ it }) => {
  const { update, remove } = useCart();
  const l = it.listing;
  const isMat = l.type === "material";
  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-slate-200" data-testid={`cart-item-${l.listing_id}`}>
      <img src={imgSrc(l.images?.[0])} alt="" className="w-24 h-24 rounded-lg object-cover" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{l.category_label} · {l.owner_name}</div>
        <Link to={`/item/${l.listing_id}`} className="font-heading font-semibold hover:text-amber-700 line-clamp-1">{l.title}</Link>
        <div className="text-sm text-slate-600">
          {rupiah(it.unit_price)} / {l.unit}
          {it.is_wholesale && <span className="ml-2 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded" data-testid="cart-wholesale-badge">Harga Grosir</span>}
        </div>
        <div className="flex items-center gap-3 pt-1">
          {isMat ? (
            <div className="flex items-center border border-slate-300 rounded-full">
              <button data-testid={`cart-dec-${l.listing_id}`} onClick={() => it.qty > 1 && update(l.listing_id, it.qty - 1)} className="w-8 h-8 grid place-items-center"><Minus className="w-3 h-3" /></button>
              <input data-testid={`cart-qty-${l.listing_id}`} type="number" defaultValue={it.qty} key={it.qty}
                onBlur={(e) => update(l.listing_id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-14 text-center font-mono text-sm outline-none bg-transparent" />
              <button data-testid={`cart-inc-${l.listing_id}`} onClick={() => update(l.listing_id, it.qty + 1)} className="w-8 h-8 grid place-items-center"><Plus className="w-3 h-3" /></button>
            </div>
          ) : <span className="text-xs font-mono text-slate-500">1 {l.unit}</span>}
          <button data-testid={`cart-remove-${l.listing_id}`} onClick={() => remove(l.listing_id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="text-right">
        <div className="font-heading font-bold" data-testid={`cart-subtotal-${l.listing_id}`}>{rupiah(it.subtotal)}</div>
        {it.savings > 0 && <div className="text-xs text-green-700">hemat {rupiah(it.savings)}</div>}
      </div>
    </div>
  );
};

export default function Cart() {
  const { cart } = useCart();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="cart-page">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8">Keranjang</h1>
      {cart.items.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-300 rounded-xl space-y-4" data-testid="cart-empty">
          <ShoppingCart className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-slate-600">Keranjang Anda masih kosong.</p>
          <Link to="/katalog?tab=all" className="inline-flex h-11 px-6 items-center rounded-full bg-[#1E242B] text-white font-semibold">Mulai Belanja</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-3">{cart.items.map((it) => <CartRow key={it.listing.listing_id} it={it} />)}</div>
          <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 space-y-4 h-fit lg:sticky lg:top-24">
            <div className="flex justify-between text-sm"><span className="text-slate-600">Total item</span><span className="font-mono">{cart.count}</span></div>
            {cart.savings > 0 && <div className="flex justify-between text-sm text-green-700"><span>Hemat grosir</span><span className="font-mono" data-testid="cart-savings">-{rupiah(cart.savings)}</span></div>}
            <div className="flex justify-between items-baseline border-t border-dashed pt-4"><span className="font-medium">Subtotal</span><span className="font-heading text-2xl font-bold" data-testid="cart-total">{rupiah(cart.total)}</span></div>
            <Link to="/checkout" data-testid="cart-checkout-button" className="h-12 w-full rounded-full bg-amber-600 text-white font-semibold grid place-items-center hover:bg-amber-700 transition-colors">Checkout dengan Escrow</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
