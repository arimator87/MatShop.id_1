import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg, imgSrc } from "@/lib/api";
import { TYPE_LABEL } from "@/lib/format";

const blank = (type) => ({
  type, category: "", title: "", description: "", price: "", unit: type === "material" ? "lembar" : type === "service" ? "paket" : "file",
  stock: type === "material" ? 100 : null, tiers: type === "material" ? [{ min_qty: 51, price: "" }] : [], images: [], specs: {},
  delivery_days: type === "service" ? 7 : null, shipping_fee_per_unit: type === "material" ? 2000 : null, warehouse_location: "", revisions: type === "service" ? 2 : null, file_url: "", file_format: "", file_size: "",
});

const inputCls = "w-full h-10 px-3 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const F = ({ label, children }) => <label className="block space-y-1"><span className="text-xs font-medium text-slate-600">{label}</span>{children}</label>;

export const ImagesField = ({ images, onChange, testid = "listing-image" }) => {
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd);
      onChange([...images, data.url]);
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
    e.target.value = "";
  };
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((src, i) => (
        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
          <img src={imgSrc(src)} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 grid place-items-center"><X className="w-3 h-3" /></button>
        </div>
      ))}
      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 grid place-items-center cursor-pointer hover:border-amber-600 text-slate-500" data-testid={`${testid}-upload`}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={upload} data-testid={`${testid}-input`} />
      </label>
    </div>
  );
};

const TiersField = ({ tiers, onChange }) => (
  <div className="space-y-2">
    {tiers.map((t, i) => (
      <div key={i} className="flex gap-2 items-center">
        <span className="text-xs text-slate-500 w-14">Min qty</span>
        <input type="number" className={inputCls} value={t.min_qty} data-testid={`tier-min-${i}`}
          onChange={(e) => onChange(tiers.map((x, k) => (k === i ? { ...x, min_qty: e.target.value } : x)))} />
        <span className="text-xs text-slate-500 w-12">Harga</span>
        <input type="number" className={inputCls} value={t.price} data-testid={`tier-price-${i}`}
          onChange={(e) => onChange(tiers.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} />
        <button type="button" onClick={() => onChange(tiers.filter((_, k) => k !== i))} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
      </div>
    ))}
    <button type="button" data-testid="tier-add" onClick={() => onChange([...tiers, { min_qty: "", price: "" }])}
      className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Tambah tier grosir</button>
  </div>
);

export const ListingForm = ({ open, onClose, types, initial, onSaved }) => {
  const [f, setF] = useState(blank(types[0]));
  const [cats, setCats] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/meta/categories").then(({ data }) => setCats(data)); }, []);
  useEffect(() => { if (open) setF(initial ? { ...blank(initial.type), ...initial } : blank(types[0])); }, [open, initial, types]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (v) => (v === "" || v === null ? null : Number(v));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, price: num(f.price), stock: num(f.stock), delivery_days: num(f.delivery_days), revisions: num(f.revisions), shipping_fee_per_unit: num(f.shipping_fee_per_unit),
      tiers: f.type === "material" ? f.tiers.filter((t) => t.min_qty && t.price).map((t) => ({ min_qty: Number(t.min_qty), price: Number(t.price) })) : [] };
    try {
      if (initial) await api.put(`/listings/${initial.listing_id}`, body);
      else await api.post("/listings", body);
      toast.success("Listing disimpan");
      onSaved();
      onClose();
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="listing-form-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl">{initial ? "Edit Listing" : "Tambah Listing"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {!initial && types.length > 1 && (
            <div className="flex gap-2">
              {types.map((t) => (
                <button type="button" key={t} data-testid={`listing-type-${t}`} onClick={() => setF(blank(t))}
                  className={`h-9 px-4 rounded-full text-sm border ${f.type === t ? "bg-[#1E242B] text-white" : "bg-white"}`}>{TYPE_LABEL[t]}</button>
              ))}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Kategori">
              <select required className={inputCls} value={f.category} onChange={set("category")} data-testid="listing-category-select">
                <option value="">Pilih kategori</option>
                {Object.entries(cats[f.type] || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </F>
            <F label="Judul"><input required className={inputCls} value={f.title} onChange={set("title")} data-testid="listing-title-input" /></F>
          </div>
          <F label="Deskripsi"><textarea className={`${inputCls} h-20 py-2`} value={f.description} onChange={set("description")} data-testid="listing-description-input" /></F>
          <div className="grid grid-cols-3 gap-4">
            <F label={f.type === "material" ? "Harga eceran (Rp)" : "Harga (Rp)"}><input required type="number" className={inputCls} value={f.price} onChange={set("price")} data-testid="listing-price-input" /></F>
            <F label="Satuan"><input className={inputCls} value={f.unit} onChange={set("unit")} data-testid="listing-unit-input" /></F>
            {f.type === "material" && <F label="Stok"><input type="number" className={inputCls} value={f.stock ?? ""} onChange={set("stock")} data-testid="listing-stock-input" /></F>}
            {f.type === "service" && <F label="Hari kerja"><input type="number" className={inputCls} value={f.delivery_days ?? ""} onChange={set("delivery_days")} data-testid="listing-days-input" /></F>}
            {f.type === "asset" && <F label="Format"><input className={inputCls} placeholder=".SKP" value={f.file_format || ""} onChange={set("file_format")} data-testid="listing-format-input" /></F>}
          </div>
          {f.type === "material" && <F label="Harga Grosir Bertingkat (contoh: ≥51 lembar)"><TiersField tiers={f.tiers} onChange={(tiers) => setF({ ...f, tiers })} /></F>}
          {f.type === "material" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <F label="Estimasi ongkir kargo / unit (Rp)"><input type="number" min={0} className={inputCls} value={f.shipping_fee_per_unit ?? ""} onChange={set("shipping_fee_per_unit")} data-testid="listing-shipfee-input" /></F>
              <F label="Lokasi gudang (ambil mandiri)"><input className={inputCls} value={f.warehouse_location || ""} onChange={set("warehouse_location")} data-testid="listing-warehouse-input" /></F>
            </div>
          )}
          {f.type === "service" && <F label="Jumlah revisi"><input type="number" className={inputCls} value={f.revisions ?? ""} onChange={set("revisions")} data-testid="listing-revisions-input" /></F>}
          {f.type === "asset" && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2"><F label="Link file aset (Google Drive / Dropbox)"><input required className={inputCls} value={f.file_url || ""} onChange={set("file_url")} data-testid="listing-fileurl-input" /></F></div>
              <F label="Ukuran file"><input className={inputCls} placeholder="84 MB" value={f.file_size || ""} onChange={set("file_size")} data-testid="listing-filesize-input" /></F>
            </div>
          )}
          <F label="Foto produk"><ImagesField images={f.images} onChange={(images) => setF({ ...f, images })} /></F>
          <button type="submit" disabled={busy} data-testid="listing-form-submit"
            className="h-11 w-full rounded-full bg-amber-600 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
