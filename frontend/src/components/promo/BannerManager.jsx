import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api, errMsg, imgSrc } from "@/lib/api";
import { ImagesField } from "@/components/ListingForm";

export const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
export const F = ({ label, children, cls = "" }) => <label className={`block space-y-1.5 ${cls}`}><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;

export const DateRange = ({ f, setF, prefix }) => (
  <div className="grid grid-cols-2 gap-3">
    <F label="Mulai (opsional)"><input type="date" className={inputCls} value={f.start_date || ""} onChange={(e) => setF({ ...f, start_date: e.target.value || null })} data-testid={`${prefix}-start-date`} /></F>
    <F label="Selesai (opsional)"><input type="date" className={inputCls} value={f.end_date || ""} onChange={(e) => setF({ ...f, end_date: e.target.value || null })} data-testid={`${prefix}-end-date`} /></F>
  </div>
);

export const schedule = (x) => (x.start_date || x.end_date ? `${x.start_date || "…"} s/d ${x.end_date || "…"}` : "Tanpa jadwal");

const EMPTY = { name: "", image: "", link_url: "", active: true, start_date: null, end_date: null };

const BannerForm = ({ init, onSaved, onCancel }) => {
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { banner_id, created_at, updated_at, ...body } = f;
      if (banner_id) await api.put(`/admin/banners/${banner_id}`, body); else await api.post("/admin/banners", body);
      toast.success("Banner pop-up disimpan");
      onSaved();
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-testid="banner-form">
      <F label="Nama banner (internal)"><input className={inputCls} value={f.name} onChange={set("name")} placeholder="mis. Promo Akhir Tahun" data-testid="banner-name-input" /></F>
      <F label="Gambar pop-up (disarankan rasio 2:3 / portrait)">
        <ImagesField images={f.image ? [f.image] : []} onChange={(x) => setF({ ...f, image: x[x.length - 1] || "" })} testid="banner-image" />
      </F>
      <F label="Tautan saat diklik (opsional — kosongkan jika hanya informasi)">
        <input className={inputCls} value={f.link_url} onChange={set("link_url")} placeholder="/katalog?tab=all atau https://..." data-testid="banner-link-input" />
      </F>
      <DateRange f={f} setF={setF} prefix="banner" />
      <div className="flex items-center gap-3"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} data-testid="banner-active-switch" /><span className="text-sm">Aktifkan (banner aktif lain otomatis dinonaktifkan)</span></div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || f.name.trim().length < 2 || !f.image} data-testid="banner-save"
          className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Banner</button>
        <button type="button" onClick={onCancel} className="h-11 px-5 rounded-full border border-slate-300 text-sm" data-testid="banner-cancel">Batal</button>
      </div>
    </form>
  );
};

const BannerRow = ({ b, onEdit, onToggle, onDelete }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-center" data-testid={`banner-row-${b.banner_id}`}>
    <img src={imgSrc(b.image)} alt="" className="w-16 h-24 rounded-md object-cover bg-[#F1EFE9] shrink-0" />
    <div className="flex-1 min-w-0 space-y-1 text-sm">
      <div className="font-heading font-semibold">{b.name}</div>
      <div className="text-xs text-slate-500 truncate">{b.link_url ? `Link: ${b.link_url}` : "Hanya informasi (tanpa link)"}</div>
      <div className="text-xs text-slate-500">{schedule(b)}</div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <Switch checked={b.active} onCheckedChange={() => onToggle(b)} data-testid={`banner-toggle-${b.banner_id}`} />
      <button onClick={() => onEdit(b)} data-testid={`banner-edit-${b.banner_id}`} className="text-slate-600 hover:text-slate-900"><Pencil className="w-4 h-4" /></button>
      <button onClick={() => onDelete(b)} data-testid={`banner-delete-${b.banner_id}`} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
    </div>
  </div>
);

export const BannerManager = () => {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/admin/banners").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);
  const toggle = async (b) => {
    const { banner_id, created_at, updated_at, ...body } = b;
    try { await api.put(`/admin/banners/${banner_id}`, { ...body, active: !b.active }); toast.success(b.active ? "Banner dinonaktifkan" : "Banner diaktifkan"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (b) => {
    if (!window.confirm(`Hapus banner "${b.name}"?`)) return;
    try { await api.delete(`/admin/banners/${b.banner_id}`); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <section className="space-y-4" data-testid="banner-manager">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Pop-up Banner Informasi</h3>
          <p className="text-xs text-slate-500">Hanya 1 banner aktif. Muncul 1x per sesi; muncul lagi untuk semua pengunjung setiap kali banner diubah. Nonaktifkan semua jika tidak ada informasi.</p>
        </div>
        {!editing && <button onClick={() => setEditing(EMPTY)} data-testid="banner-new" className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Banner Baru</button>}
      </div>
      {editing && <BannerForm init={editing} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
      {!items ? <div className="h-24 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0
        ? <div className="py-10 text-center border border-dashed rounded-xl text-slate-500" data-testid="banner-empty">Belum ada banner.</div>
        : <div className="space-y-3">{items.map((b) => <BannerRow key={b.banner_id} b={b} onEdit={setEditing} onToggle={toggle} onDelete={remove} />)}</div>}
    </section>
  );
};
