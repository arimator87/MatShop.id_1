import { useEffect, useState } from "react";
import { Loader2, MousePointerClick, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api, errMsg, imgSrc } from "@/lib/api";
import { ImagesField } from "@/components/ListingForm";
import { DateRange, F, inputCls, schedule } from "@/components/promo/BannerManager";
import { rupiah } from "@/lib/format";

const PLACES = { home: "Beranda (Katalog)", catalog: "Halaman Katalog" };
const EMPTY = { ad_type: "brand", vendor_id: null, title: "", advertiser: "", image: "", description: "", link_url: "", cta: "Lihat Promo", placements: ["home", "catalog"], active: true, start_date: null, end_date: null, contract_value: 0, paid: false, payment_note: "" };
const strip = ({ ad_id, clicks, created_at, updated_at, notified_at, vendor, ...body }) => body;
const TYPES = { brand: "Brand Umum", vendor: "Vendor MatShop" };

const AdForm = ({ init, vendors, onSaved, onCancel }) => {
  const [f, setF] = useState({ ...EMPTY, ...init });
  const isVendor = f.ad_type === "vendor";
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const togglePlace = (p) => setF({ ...f, placements: f.placements.includes(p) ? f.placements.filter((x) => x !== p) : [...f.placements, p] });
  const valid = f.title.trim().length >= 2 && f.placements.length && (isVendor ? !!f.vendor_id : f.advertiser.trim().length >= 2 && !!f.image);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...strip(f), contract_value: Number(f.contract_value) || 0 };
      if (f.ad_id) await api.put(`/admin/ads/${f.ad_id}`, body); else await api.post("/admin/ads", body);
      toast.success("Iklan sponsor disimpan");
      onSaved();
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-2 gap-4" data-testid="ad-form">
      <div className="sm:col-span-2 space-y-1.5"><span className="text-sm font-medium text-slate-700">Jenis pengiklan</span>
        <div className="flex gap-2">{Object.entries(TYPES).map(([k, l]) => (
          <button type="button" key={k} onClick={() => setF({ ...f, ad_type: k })} data-testid={`ad-type-${k}`}
            className={`h-10 px-5 rounded-full border text-sm font-medium transition-colors ${f.ad_type === k ? "bg-[#1E242B] text-white border-[#1E242B]" : "border-slate-300 hover:border-slate-500"}`}>{l}</button>
        ))}</div>
      </div>
      {isVendor ? (
        <F label="Vendor terverifikasi (nama, foto, rating & badge otomatis)">
          <select className={inputCls} value={f.vendor_id || ""} onChange={(e) => setF({ ...f, vendor_id: e.target.value || null })} data-testid="ad-vendor-select">
            <option value="">Pilih Supplier / Kontraktor / Desainer</option>
            {vendors.map((v) => <option key={v.user_id} value={v.user_id}>{`${v.business_name} · ${v.city}`}</option>)}
          </select>
        </F>
      ) : <F label="Nama pengiklan / brand"><input className={inputCls} value={f.advertiser} onChange={set("advertiser")} data-testid="ad-advertiser-input" /></F>}
      <F label="Judul iklan"><input className={inputCls} value={f.title} onChange={set("title")} data-testid="ad-title-input" /></F>
      <F label="Deskripsi singkat (opsional)" cls="sm:col-span-2"><input className={inputCls} value={f.description} onChange={set("description")} maxLength={200} data-testid="ad-description-input" /></F>
      <F label="Tautan (opsional)"><input className={inputCls} value={f.link_url} onChange={set("link_url")} placeholder={isVendor ? "Kosong = buka profil vendor" : "Kosong = kartu hanya informasi"} data-testid="ad-link-input" /></F>
      <F label="Teks tombol"><input className={inputCls} value={f.cta} onChange={set("cta")} maxLength={30} data-testid="ad-cta-input" /></F>
      <F label={isVendor ? "Gambar iklan (opsional — kosong = foto portofolio vendor)" : "Gambar iklan (rasio 4:3)"} cls="sm:col-span-2"><ImagesField images={f.image ? [f.image] : []} onChange={(x) => setF({ ...f, image: x[x.length - 1] || "" })} testid="ad-image" /></F>
      <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Penempatan</span>
        <div className="flex flex-wrap gap-2">{Object.entries(PLACES).map(([k, l]) => (
          <button type="button" key={k} onClick={() => togglePlace(k)} data-testid={`ad-place-${k}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${f.placements.includes(k) ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300"}`}>{l}</button>
        ))}</div>
      </div>
      <div className="flex items-center gap-3"><Switch checked={f.active} onCheckedChange={(active) => setF({ ...f, active })} data-testid="ad-active-switch" /><span className="text-sm">Aktif</span></div>
      <div className="sm:col-span-2"><DateRange f={f} setF={setF} prefix="ad" /></div>
      <div className="sm:col-span-2 rounded-lg bg-[#F8F7F4] border border-slate-200 p-4 grid sm:grid-cols-3 gap-4 items-end">
        <F label="Nilai Kontrak Iklan (Rp)"><input type="number" min="0" className={inputCls} value={f.contract_value} onChange={set("contract_value")} data-testid="ad-contract-input" /></F>
        <div className="flex items-center gap-3 h-11"><Switch checked={f.paid} onCheckedChange={(paid) => setF({ ...f, paid })} data-testid="ad-paid-switch" /><span className="text-sm">{f.paid ? "Lunas" : "Belum Lunas"}</span></div>
        <F label="Catatan pembayaran"><input className={inputCls} value={f.payment_note} onChange={set("payment_note")} placeholder="mis. Transfer BCA 12/06" data-testid="ad-payment-note-input" /></F>
        <p className="sm:col-span-3 text-xs text-slate-500">Iklan hanya tayang jika <b>Lunas</b> dan <b>Aktif</b> (serta dalam jadwal).</p>
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" disabled={busy || !valid} data-testid="ad-save" className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Iklan</button>
        <button type="button" onClick={onCancel} className="h-11 px-5 rounded-full border border-slate-300 text-sm" data-testid="ad-cancel">Batal</button>
      </div>
    </form>
  );
};

const AdRow = ({ a, vendorName, onEdit, onToggle, onDelete }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-center" data-testid={`ad-row-${a.ad_id}`}>
    <img src={imgSrc(a.image)} alt="" className="w-24 h-18 aspect-[4/3] rounded-md object-cover bg-[#F1EFE9] shrink-0" />
    <div className="flex-1 min-w-0 space-y-1 text-sm">
      <div className="font-heading font-semibold line-clamp-1">{a.title}</div>
      <div className="text-xs text-amber-700">{TYPES[a.ad_type || "brand"]}: {a.ad_type === "vendor" ? vendorName(a.vendor_id) : a.advertiser} · {a.placements.map((p) => PLACES[p]).join(", ")}</div>
      <div className="text-xs flex flex-wrap gap-2 items-center">
        <span className="font-mono">{rupiah(a.contract_value || 0)}</span>
        <span className={`px-2 py-0.5 rounded-full ${a.paid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`} data-testid={`ad-paid-${a.ad_id}`}>{a.paid ? "Lunas" : "Belum Lunas"}</span>
        {a.active && a.paid ? <span className="text-green-700">● Tayang</span> : <span className="text-slate-400">● Tidak tayang</span>}
      </div>
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
  const [vendors, setVendors] = useState([]);
  useEffect(() => { api.get("/portfolios", { params: { limit: 50 } }).then(({ data }) => setVendors(data)); }, []);
  const vendorName = (id) => vendors.find((v) => v.user_id === id)?.business_name || id;
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
          <p className="text-xs text-slate-500">Kartu "Sponsor" disisipkan setiap 4 produk. Untuk brand umum atau vendor MatShop yang membayar iklan; vendor ber-iklan juga mendapat label Sponsor di kartu portofolionya.</p>
        </div>
        {!editing && <button onClick={() => setEditing(EMPTY)} data-testid="ad-new" className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Iklan Baru</button>}
      </div>
      {editing && <AdForm init={editing} vendors={vendors} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
      {!items ? <div className="h-24 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0
        ? <div className="py-10 text-center border border-dashed rounded-xl text-slate-500" data-testid="ad-empty">Belum ada iklan.</div>
        : <div className="space-y-3">{items.map((a) => <AdRow key={a.ad_id} a={a} vendorName={vendorName} onEdit={setEditing} onToggle={toggle} onDelete={remove} />)}</div>}
    </section>
  );
};
