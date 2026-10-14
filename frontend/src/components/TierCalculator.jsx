import { Minus, Plus, TrendingDown } from "lucide-react";
import { rupiah, unitPrice } from "@/lib/format";

export const TierCalculator = ({ l, qty, setQty }) => {
  const up = unitPrice(l, qty);
  const tiers = [{ min_qty: 1, price: l.price, label: "Eceran" }, ...l.tiers.map((t) => ({ ...t, label: "Grosir" }))];
  const activeIdx = tiers.reduce((acc, t, i) => (qty >= t.min_qty ? i : acc), 0);
  const savings = (l.price - up) * qty;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="tier-calculator">
      <div className="px-5 py-3 bg-[#F1EFE9] text-xs font-mono uppercase tracking-widest text-slate-600">Tiered Pricing · Harga Bertingkat</div>
      <div className="divide-y divide-slate-100">
        {tiers.map((t, i) => {
          const next = tiers[i + 1];
          const range = next ? `${t.min_qty}–${next.min_qty - 1}` : `≥${t.min_qty}`;
          return (
            <div key={i} data-testid={`tier-row-${i}`}
              className={`px-5 py-3 flex items-center justify-between text-sm transition-colors ${i === activeIdx ? "bg-amber-50" : ""}`}>
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${i === activeIdx ? "bg-amber-600" : "bg-slate-300"}`} />
                {t.label} · {range} {l.unit}
              </span>
              <span className="font-mono font-semibold">{rupiah(t.price)}</span>
            </div>
          );
        })}
      </div>
      <div className="p-5 border-t border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Jumlah ({l.unit})</span>
          <div className="flex items-center border border-slate-300 rounded-full">
            <button data-testid="qty-decrease" onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 grid place-items-center hover:bg-slate-100 rounded-l-full"><Minus className="w-4 h-4" /></button>
            <input data-testid="qty-input" type="number" min={1} value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 text-center font-mono outline-none bg-transparent" />
            <button data-testid="qty-increase" onClick={() => setQty(qty + 1)} className="w-10 h-10 grid place-items-center hover:bg-slate-100 rounded-r-full"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex justify-between text-sm"><span className="text-slate-600">Harga satuan</span><span className="font-mono" data-testid="calc-unit-price">{rupiah(up)}</span></div>
        {savings > 0 && (
          <div className="flex justify-between text-sm text-green-700" data-testid="calc-savings">
            <span className="flex items-center gap-1"><TrendingDown className="w-4 h-4" /> Hemat harga grosir</span>
            <span className="font-mono">-{rupiah(savings)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-slate-200">
          <span className="font-medium">Total</span>
          <span className="font-heading text-2xl font-bold" data-testid="calc-total">{rupiah(up * qty)}</span>
        </div>
      </div>
    </div>
  );
};
