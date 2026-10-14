import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { ImagesField } from "@/components/ListingForm";
import { StarInput, Stars } from "@/components/Stars";

const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const EMPTY = { vendor_id: "", reviewer_name: "", subject: "", rating: 0, comment: "", photos: [] };

const ReviewList = ({ items, vendors, onDelete }) => (
  <div className="space-y-3" data-testid="admin-review-list">
    {items.length === 0 && <div className="py-10 text-center border border-dashed rounded-xl text-slate-500">Belum ada ulasan yang ditambahkan admin.</div>}
    {items.map((r) => (
      <div key={r.review_id} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 justify-between" data-testid={`admin-review-${r.review_id}`}>
        <div className="space-y-1 text-sm min-w-0">
          <div className="flex items-center gap-2"><Stars value={r.rating} size="w-3.5 h-3.5" /><b>{vendors[r.vendor_id] || r.vendor_id}</b></div>
          <p className="text-slate-700">"{r.comment}"</p>
          <div className="text-xs text-slate-500">{r.reviewer_name} · {r.subject} · oleh {r.added_by}</div>
        </div>
        <button onClick={() => onDelete(r.review_id)} data-testid={`admin-review-delete-${r.review_id}`} className="text-red-600 hover:text-red-800 shrink-0" title="Hapus"><Trash2 className="w-4 h-4" /></button>
      </div>
    ))}
  </div>
);

export const AdminReviewBoard = () => {
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/reviews").then(({ data }) => setItems(data));
  useEffect(() => { api.get("/portfolios", { params: { limit: 50 } }).then(({ data }) => setVendors(data)); load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.vendor_id && f.reviewer_name.trim().length >= 2 && f.subject.trim().length >= 3 && f.rating && f.comment.trim().length >= 10;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/admin/reviews", f); toast.success("Ulasan proyek offline ditambahkan"); setF(EMPTY); load(); } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  const remove = async (id) => {
    if (!window.confirm("Hapus ulasan ini?")) return;
    try { await api.delete(`/admin/reviews/${id}`); toast.success("Ulasan dihapus"); load(); } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start" data-testid="admin-review-board">
      <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-testid="admin-review-form">
        <div>
          <div className="font-heading font-semibold text-lg">Tambah Ulasan Proyek Offline</div>
          <p className="text-xs text-slate-500">Untuk proyek yang dikerjakan vendor di luar platform & sudah diverifikasi tim MatShop. Dihitung sebagai transaksi selesai untuk lencana Top Rated.</p>
        </div>
        <select value={f.vendor_id} onChange={set("vendor_id")} className={inputCls} data-testid="admin-review-vendor-select">
          <option value="">Pilih vendor terverifikasi</option>
          {vendors.map((v) => <option key={v.user_id} value={v.user_id}>{v.business_name} · {v.city}</option>)}
        </select>
        <input value={f.reviewer_name} onChange={set("reviewer_name")} placeholder="Nama klien" className={inputCls} data-testid="admin-review-reviewer-input" />
        <input value={f.subject} onChange={set("subject")} placeholder="Nama/jenis proyek, mis. Kitchen Set 3 m" className={inputCls} data-testid="admin-review-subject-input" />
        <StarInput value={f.rating} onChange={(rating) => setF({ ...f, rating })} />
        <textarea value={f.comment} onChange={set("comment")} rows={3} placeholder="Testimoni klien (min. 10 karakter)" data-testid="admin-review-comment-input"
          className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
        <ImagesField images={f.photos} onChange={(photos) => setF({ ...f, photos: photos.slice(0, 4) })} testid="admin-review-photo" />
        <button type="submit" disabled={busy || !valid} data-testid="admin-review-submit"
          className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Ulasan
        </button>
      </form>
      <ReviewList items={items} vendors={Object.fromEntries(vendors.map((v) => [v.user_id, v.business_name]))} onDelete={remove} />
    </div>
  );
};
