import { useEffect, useState } from "react";
import { Loader2, MousePointerClick, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api, errMsg, imgSrc } from "@/lib/api";
import { ImagesField } from "@/components/ListingForm";
import { DateRange, F, inputCls, schedule } from "@/components/promo/BannerManager";

const PLACES = { home: "Beranda (Katalog)", catalog: "Halaman Katalog" };
const EMPTY = { title: "", advertiser: "", image: "", description: "", link_url: "", cta: "Lihat Promo", placements: ["home", "catalog"], active: true, start_date: null, end_date: null };
const strip = ({ ad_id, clicks, created_at, updated_at, ...body }) => body;

const AdForm = ({ init, onSaved, onCancel }) => {
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const togglePlace = (p) => setF({ ...f, placements: f.placements.includes(p) ? f.placements.filter((x) => x !== p) : [...f.placements, p] });
  const valid = f.title.trim().length >= 2 && f.advertiser.trim().length >= 2 && f.image && f.link_url.trim() && f.placements.length;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (f.ad_id) await api.put(`/admin/ads/${f.ad_id}`, strip(f)); else await api.post("/admin/ads", f);
      toast.success("Iklan sponsor disimpan");
      onSaved();
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-2 gap-4" data-testid="ad-form">
      <F label="Judul iklan"><input className={inputCls} value={f.title} onChange={set("title")} data-testid="ad-title-input" /></F>
      <F label="Nama pengiklan / brand"><input className={inputCls} value={f.advertiser} onChange={set("advertiser")} data-testid="ad-advertiser-input" /></F>
      <F label="Deskripsi singkat (opsional)" cls="sm:col-span-2"><input className={inputCls} value={f.description} onChange={set("description")} maxLength={200} data-testid="ad-description-input" /></F>
      <F label="Tautan tujuan"><input className={inputCls} value={f.link_url} onChange={set("link_url")} placeholder="https://brand.com atau /item/..." data-testid="ad-link-input" /></F>
      <F label="Teks tombol"><input className={inputCls} value={f.cta} onChange={set("cta")} maxLength={30} data-testid="ad-cta-input" /></F>
      <F label="Gambar iklan (rasio 4:3)" cls="sm:col-span-2"><ImagesField images={f.image ? [f.image] : []} onChange={(x) => setF({ ...f, image: x[x.length - 1] || "" })} testid="ad-image" /></F>
      <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Penempatan</span>
        <div className="flex flex-wrap gap-2">{Object.entries(PLACES).map(([k, l]) => (
          <button type="button" key={k} onClick={() => togglePlace(k)} data-testid={`ad-place-${k}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${f.placements.includes(k) ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300"}`}>{l}</button>
        ))}</div>
      </div>
      <div className="flex items-center gap-3"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} data-testid="ad-active-switch" /><span className="text-sm">Aktif</span></div>
      <div className="sm:col-span-2"><DateRange f={f} setF={setF} prefix="ad" /></div>
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" disabled={busy || !valid} data-testid="ad-save" className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Iklan</button>
        <button type="button" onClick={onCancel} className="h-11 px-5 rounded-full border border-slate-300 text-sm" data-testid="ad-cancel">Batal</button>
      </div>
    </form>
  );
};

const AdRow = ({ a, onEdit, onToggle, onDelete }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-center" data-testid={`ad-row-${a.ad_id}`}>
    <img src={imgSrc(a.image)} alt="" className="w-24 h-18 aspect-[4/3] rounded-md object-cover bg-[#F1EFE9] shrink-0" />
    <div className="flex-1 min-w-0 space-y-1 text-sm">
      <div className="font-heading font-semibold line-clamp-1">{a.title}</div>
      <div className="text-xs text-amber-700">{a.advertiser} · {a.placements.map((p) => PLACES[p]).join(", ")}</div>
      <div className="text-xs text-slate-500 flex flex-wrap gap-x-3"><span>{schedule(a)}</span><span className="inline-flex items-center gap-1" data-testid={`ad-clicks-${a.ad_id}`}><MousePointerClick className="w-3 h-3" />{a.clicks} klik</span></div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <Switch checked={a.active} onCheckedChange={() => onToggle(a)} data-testid={`ad-toggle-${a.ad_id}`} />
      <button onClick={() => onEdit(a)} data-testid={`ad-edit-${a.ad_id}`} className="text-slate-600 hover:text-slate-900"><Pencil className="w-4 h-4" /></button>
      <button onClick={() => onDelete(a)} data-testid={`ad-delete-${a.ad_id}`} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
    </div>
  </div>
);

export const AdManager = () => {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/admin/ads").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);
  const toggle = async (a) => {
    try { await api.put(`/admin/ads/${a.ad_id}`, { ...strip(a), active: !a.active }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (a) => {
    if (!window.confirm(`Hapus iklan "${a.title}"?`)) return;
    try { await api.delete(`/admin/ads/${a.ad_id}`); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <section className="space-y-4" data-testid="ad-manager">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">In-Feed Ads · Iklan Produk Sponsor</h3>
          <p className="text-xs text-slate-500">Kartu berlabel "Sponsor" disisipkan setiap 4 produk di katalog. Bisa untuk brand siapa pun, tautan internal maupun eksternal.</p>
        </div>
        {!editing && <button onClick={() => setEditing(EMPTY)} data-testid="ad-new" className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Iklan Baru</button>}
      </div>
      {editing && <AdForm init={editing} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
      {!items ? <div className="h-24 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0
        ? <div className="py-10 text-center border border-dashed rounded-xl text-slate-500" data-testid="ad-empty">Belum ada iklan.</div>
        : <div className="space-y-3">{items.map((a) => <AdRow key={a.ad_id} a={a} onEdit={setEditing} onToggle={toggle} onDelete={remove} />)}</div>}
    </section>
  );
};
