import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";

const inputCls = "h-10 px-3 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const blankItem = { item: "", qty: 1, unit: "ls", price: "" };

export const BidForm = ({ project, existing, onDone }) => {
  const [items, setItems] = useState(existing?.rab_items?.map(({ subtotal, ...i }) => i) || [
    { item: "Material & fabrikasi workshop", qty: project.size, unit: project.unit === "m2" ? "m2" : "m lari", price: "" },
    { item: "Pemasangan & finishing di lokasi", qty: 1, unit: "ls", price: "" },
  ]);
  const [days, setDays] = useState(existing?.duration_days || 21);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const upd = (k, field, v) => setItems(items.map((x, j) => (j === k ? { ...x, [field]: v } : x)));

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/custom/projects/${project.project_id}/bids`, {
        duration_days: Number(days), notes,
        rab_items: items.filter((i) => i.item && i.price).map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price) })),
      });
      toast.success(existing ? "Penawaran diperbarui" : "Penawaran RAB terkirim ke klien");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-testid="bid-form">
      <h3 className="font-heading font-semibold text-lg">{existing ? "Perbarui Penawaran / RAB" : "Ajukan Penawaran / RAB"}</h3>
      <div className="space-y-2 overflow-x-auto">
        <div className="grid grid-cols-[minmax(160px,1fr)_70px_80px_120px_110px_32px] gap-2 text-xs font-mono uppercase text-slate-500 min-w-[600px]">
          <span>Item Pekerjaan</span><span>Qty</span><span>Satuan</span><span>Harga</span><span className="text-right">Subtotal</span><span />
        </div>
        {items.map((i, k) => (
          <div key={k} className="grid grid-cols-[minmax(160px,1fr)_70px_80px_120px_110px_32px] gap-2 items-center min-w-[600px]">
            <input className={inputCls} value={i.item} onChange={(e) => upd(k, "item", e.target.value)} data-testid={`bid-item-${k}`} />
            <input type="number" className={inputCls} value={i.qty} onChange={(e) => upd(k, "qty", e.target.value)} data-testid={`bid-qty-${k}`} />
            <input className={inputCls} value={i.unit} onChange={(e) => upd(k, "unit", e.target.value)} data-testid={`bid-unit-${k}`} />
            <input type="number" className={inputCls} value={i.price} onChange={(e) => upd(k, "price", e.target.value)} data-testid={`bid-price-${k}`} />
            <span className="text-right font-mono text-sm">{rupiah((Number(i.qty) || 0) * (Number(i.price) || 0))}</span>
            <button type="button" onClick={() => setItems(items.filter((_, j) => j !== k))} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button type="button" data-testid="bid-add-item" onClick={() => setItems([...items, blankItem])}
          className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Tambah item RAB</button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="space-y-1"><span className="text-xs text-slate-600">Durasi pengerjaan (hari)</span>
          <input type="number" className={`${inputCls} w-full`} value={days} onChange={(e) => setDays(e.target.value)} data-testid="bid-days-input" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-slate-600">Catatan penawaran</span>
          <input className={`${inputCls} w-full`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Garansi, merk material, jadwal survey..." data-testid="bid-notes-input" /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
        <div>Total RAB <span className="font-heading text-2xl font-bold ml-2" data-testid="bid-total">{rupiah(total)}</span></div>
        <button onClick={submit} disabled={busy || total <= 0} data-testid="bid-submit-button"
          className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {existing ? "Perbarui Penawaran" : "Kirim Penawaran"}
        </button>
      </div>
    </div>
  );
};
