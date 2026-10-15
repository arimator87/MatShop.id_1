import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, RotateCcw, Ruler } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api, errMsg, imgSrc } from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { ImagesField } from "@/components/ListingForm";
import { HERO_DEFAULT, HERO_FIELDS, IMAGE_SLOTS, PWA_DEFAULT, PWA_FIELDS, SECTION_LABELS, SIZE_GUIDE } from "@/lib/site";

const Card = ({ title, desc, children, testid }) => (
  <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-testid={testid}>
    <div><h3 className="font-heading text-lg font-semibold">{title}</h3>{desc && <p className="text-xs text-slate-500">{desc}</p>}</div>
    {children}
  </section>
);

export const SizeGuide = () => (
  <Card title="Panduan Ukuran Desain" desc="Gunakan ukuran berikut agar gambar tampil rapi di desktop & smartphone." testid="size-guide">
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <tbody className="divide-y divide-slate-100">
          {SIZE_GUIDE.map(([n, s, t]) => (
            <tr key={n}><td className="py-2 font-medium flex items-center gap-2"><Ruler className="w-4 h-4 text-amber-600" />{n}</td><td className="py-2 font-mono text-xs">{s}</td><td className="py-2 text-xs text-slate-500">{t}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const ImageSlot = ({ k, value, onChange }) => {
  const slot = IMAGE_SLOTS[k];
  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3" data-testid={`site-image-${k}`}>
      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#F1EFE9]"><img src={imgSrc(value || slot.url)} alt="" className="w-full h-full object-cover" /></div>
      <div>
        <div className="font-semibold text-sm">{slot.label}</div>
        <div className="text-xs text-slate-500">{slot.where}</div>
        <div className="text-xs font-mono text-amber-700 mt-1">Ukuran: {slot.size}</div>
      </div>
      <div className="flex items-center gap-3">
        <ImagesField images={[]} onChange={(x) => x[0] && onChange(x[0])} testid={`site-image-${k}`} />
        {value && <button type="button" onClick={() => onChange("")} data-testid={`site-image-reset-${k}`} className="text-xs text-slate-600 inline-flex items-center gap-1 hover:text-red-600"><RotateCcw className="w-3.5 h-3.5" /> Kembalikan bawaan</button>}
      </div>
    </div>
  );
};

const SectionOrder = ({ items, setItems }) => {
  const move = (i, d) => { const n = [...items]; [n[i], n[i + d]] = [n[i + d], n[i]]; setItems(n); };
  return (
    <ol className="space-y-2" data-testid="section-order">
      <li className="flex items-center gap-3 rounded-lg bg-slate-50 border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">Hero (selalu di paling atas)</li>
      {items.map((s, i) => (
        <li key={s.key} className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${s.visible ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 text-slate-400"}`} data-testid={`section-row-${s.key}`}>
          <span className="font-mono text-xs w-5">{i + 1}</span>
          <span className="flex-1">{SECTION_LABELS[s.key]}</span>
          <button type="button" disabled={i === 0} onClick={() => move(i, -1)} data-testid={`section-up-${s.key}`} className="w-8 h-8 rounded-full border grid place-items-center disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
          <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} data-testid={`section-down-${s.key}`} className="w-8 h-8 rounded-full border grid place-items-center disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
          <Switch checked={s.visible} onCheckedChange={(v) => setItems(items.map((x) => (x.key === s.key ? { ...x, visible: v } : x)))} data-testid={`section-visible-${s.key}`} />
        </li>
      ))}
    </ol>
  );
};

export const SiteManager = () => {
  const site = useSite();
  const [images, setImages] = useState({});
  const [hero, setHero] = useState({});
  const [pwa, setPwa] = useState({});
  const [sections, setSections] = useState(site.sections);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setImages(site.raw.images || {}); setHero(site.raw.hero || {}); setPwa(site.raw.pwa || {}); setSections(site.sections); }, [site.raw]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/site-settings", { images, hero, sections, pwa });
      await site.reload();
      toast.success("Tampilan beranda diperbarui");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="space-y-8" data-testid="site-manager">
      <Card title="Teks Hero Beranda" desc="Kosongkan kolom untuk memakai teks bawaan." testid="site-hero-form">
        <div className="grid sm:grid-cols-2 gap-4">
          {HERO_FIELDS.map(([k, label, max]) => (
            <label key={k} className={`block space-y-1.5 ${k === "subtitle" ? "sm:col-span-2" : ""}`}>
              <span className="text-sm font-medium text-slate-700">{label} <span className="text-xs text-slate-400">(maks. {max} karakter)</span></span>
              <input value={hero[k] || ""} maxLength={max} placeholder={HERO_DEFAULT[k]} onChange={(e) => setHero({ ...hero, [k]: e.target.value })} data-testid={`site-hero-${k}`}
                className="w-full h-11 px-4 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
            </label>
          ))}
        </div>
      </Card>
      <Card title="Gambar Bawaan Website" desc="Ganti gambar dengan upload baru; klik 'Kembalikan bawaan' untuk memakai gambar awal." testid="site-images">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.keys(IMAGE_SLOTS).map((k) => <ImageSlot key={k} k={k} value={images[k]} onChange={(v) => setImages({ ...images, [k]: v })} />)}
        </div>
      </Card>
      <Card title="Urutan & Visibilitas Section Beranda" desc="Atur posisi section dan strip iklan sponsor; matikan saklar untuk menyembunyikan." testid="site-sections">
        <SectionOrder items={sections} setItems={setSections} />
      </Card>
      <Card title="Aplikasi HP (PWA)" desc="Nama, ikon, dan banner ajakan install di smartphone. Kosongkan untuk memakai bawaan." testid="site-pwa">
        <div className="grid sm:grid-cols-[160px_1fr] gap-6">
          <div className="space-y-2">
            <img src={pwa.icon ? imgSrc(pwa.icon) : "/icons/icon-512.png"} alt="" className="w-32 h-32 rounded-[28px] object-cover border" data-testid="site-pwa-icon-preview" />
            <div className="text-xs font-mono text-amber-700">Ukuran: 512 × 512 px PNG</div>
            <ImagesField images={[]} onChange={(x) => x[0] && setPwa({ ...pwa, icon: x[0] })} testid="site-pwa-icon" />
            {pwa.icon && <button type="button" onClick={() => setPwa({ ...pwa, icon: "" })} data-testid="site-pwa-icon-reset" className="text-xs text-slate-600 inline-flex items-center gap-1 hover:text-red-600"><RotateCcw className="w-3.5 h-3.5" /> Ikon bawaan</button>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 content-start">
            {PWA_FIELDS.map(([k, label, max]) => (
              <label key={k} className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{label} <span className="text-xs text-slate-400">(maks. {max})</span></span>
                <input value={pwa[k] || ""} maxLength={max} placeholder={PWA_DEFAULT[k]} onChange={(e) => setPwa({ ...pwa, [k]: e.target.value })} data-testid={`site-pwa-${k}`}
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
              </label>
            ))}
            <p className="sm:col-span-2 text-xs text-slate-500">Perubahan nama/ikon berlaku untuk instalasi baru; pengguna yang sudah install akan ter-update otomatis oleh browser dalam beberapa hari.</p>
          </div>
        </div>
      </Card>
      <SizeGuide />
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button onClick={save} disabled={busy} data-testid="site-save"
          className="h-12 px-8 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 shadow-lg hover:bg-amber-700 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Tampilan Beranda
        </button>
      </div>
    </div>
  );
};
