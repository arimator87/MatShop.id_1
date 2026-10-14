import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, imgSrc } from "@/lib/api";
import { rupiah, TYPE_LABEL } from "@/lib/format";
import { ListingForm } from "@/components/ListingForm";

export const MyListings = ({ types }) => {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ open: false, initial: null });
  const load = useCallback(() => api.get("/my/listings").then(({ data }) => setItems(data.filter((l) => types.includes(l.type)))), [types]);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    if (!window.confirm("Hapus listing ini?")) return;
    try { await api.delete(`/listings/${id}`); toast.success("Listing dihapus"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-4" data-testid="my-listings">
      <div className="flex justify-end">
        <button data-testid="add-listing-button" onClick={() => setForm({ open: true, initial: null })}
          className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Tambah Listing</button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-[#F1EFE9] text-xs font-mono uppercase tracking-wider text-slate-600">
            <tr><th className="text-left p-3">Produk</th><th className="text-left p-3">Tipe</th><th className="text-right p-3">Eceran</th><th className="text-right p-3">Grosir</th><th className="text-right p-3">Stok</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items?.map((l) => (
              <tr key={l.listing_id} data-testid={`my-listing-row-${l.listing_id}`}>
                <td className="p-3"><div className="flex items-center gap-3"><img src={imgSrc(l.images?.[0])} alt="" className="w-10 h-10 rounded object-cover bg-slate-100" /><div><div className="font-medium line-clamp-1">{l.title}</div><div className="text-xs text-slate-500">{l.category_label}</div></div></div></td>
                <td className="p-3">{TYPE_LABEL[l.type]}</td>
                <td className="p-3 text-right font-mono">{rupiah(l.price)}</td>
                <td className="p-3 text-right font-mono text-green-700">{l.tiers?.length ? l.tiers.map((t) => `≥${t.min_qty}: ${rupiah(t.price)}`).join(", ") : "—"}</td>
                <td className="p-3 text-right font-mono" data-testid={`my-listing-stock-${l.listing_id}`}>{l.stock ?? "—"}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button data-testid={`edit-listing-${l.listing_id}`} onClick={() => setForm({ open: true, initial: l })} className="p-2 text-slate-500 hover:text-slate-900"><Pencil className="w-4 h-4" /></button>
                  <button data-testid={`delete-listing-${l.listing_id}`} onClick={() => del(l.listing_id)} className="p-2 text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items?.length === 0 && <div className="p-10 text-center text-slate-500" data-testid="my-listings-empty">Belum ada listing.</div>}
      </div>
      <ListingForm open={form.open} initial={form.initial} types={types} onClose={() => setForm({ open: false, initial: null })} onSaved={load} />
    </div>
  );
};
