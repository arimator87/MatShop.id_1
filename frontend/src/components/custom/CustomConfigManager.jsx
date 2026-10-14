import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { ICONS, resetCustomConfig } from "@/lib/custom";
import { rupiah } from "@/lib/format";
import { WorkIcon } from "@/components/custom/Dims";
import { EditDialog, IconField, inputCls, moved, RowActions, useBusy } from "@/components/catalog/shared";

const MODE_HELP = {
  cabinet: "P × faktor L × faktor T (cm → m). L ≤ 60 = 1; 60–100 = 1,5; > 100 = peringatan. T < 100 = 1; T ≥ 100 = T (m).",
  surface: "P(m) × T(m). Sisi < 100 cm dihitung 1 m dan satuan menjadi Unit/Set.",
  area: "Input langsung luas lantai (m²).",
};
const F = ({ label, children }) => <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;
const chip = (on) => `text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300 hover:border-slate-500"}`;

const RateRow = ({ fin, rate, onChange }) => (
  <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center" data-testid={`wt-rate-${fin.key}`}>
    <span className="text-sm font-medium">{fin.label}</span>
    <input type="number" min={1} placeholder="Min" value={rate?.min ?? ""} onChange={(e) => onChange({ ...rate, min: e.target.value })} className={inputCls} data-testid={`wt-rate-min-${fin.key}`} />
    <input type="number" min={1} placeholder="Maks" value={rate?.max ?? ""} onChange={(e) => onChange({ ...rate, max: e.target.value })} className={inputCls} data-testid={`wt-rate-max-${fin.key}`} />
  </div>
);

const TypeDialog = ({ init, cfg, onClose, onDone }) => {
  const [f, setF] = useState(init);
  const [busy, run] = useBusy();
  const toggleFin = (k) => setF({ ...f, finishings: f.finishings.includes(k) ? f.finishings.filter((x) => x !== k) : [...f.finishings, k] });
  const valid = f.label.trim().length >= 2 && f.unit_label.trim() && f.finishings.length && f.finishings.every((k) => Number(f.rates[k]?.min) > 0 && Number(f.rates[k]?.max) >= Number(f.rates[k]?.min));
  const save = () => run(async () => {
    try {
      const rates = Object.fromEntries(f.finishings.map((k) => [k, { min: Number(f.rates[k].min), max: Number(f.rates[k].max) }]));
      const body = { label: f.label, mode: f.mode, unit_label: f.unit_label, icon: f.icon, icon_image: f.icon_image || "", hint: f.hint, finishings: f.finishings, rates, active: f.active };
      if (f.key) await api.put(`/admin/custom-work-types/${f.key}`, body); else await api.post("/admin/custom-work-types", body);
      toast.success("Jenis pekerjaan disimpan");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  });
  return (
    <EditDialog title={f.key ? "Edit Jenis Pekerjaan" : "Tambah Jenis Pekerjaan"} onClose={onClose} onSave={save} busy={busy} valid={valid} testid="wt-dialog">
      <F label="Nama jenis pekerjaan"><input className={inputCls} value={f.label} maxLength={60} onChange={(e) => setF({ ...f, label: e.target.value })} data-testid="wt-label-input" /></F>
      <F label="Mode rumus ukuran">
        <select className={inputCls} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value, unit_label: e.target.value === "cabinet" ? "meter lari" : "m²" })} data-testid="wt-mode-select">
          {Object.entries(cfg.modes).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </F>
      <p className="text-xs text-slate-500 -mt-2" data-testid="wt-mode-help">{MODE_HELP[f.mode]}</p>
      <div className="grid grid-cols-2 gap-3">
        <F label="Satuan harga"><input className={inputCls} value={f.unit_label} maxLength={20} onChange={(e) => setF({ ...f, unit_label: e.target.value })} data-testid="wt-unit-input" /></F>
        <F label="Petunjuk ukuran"><input className={inputCls} value={f.hint} maxLength={120} onChange={(e) => setF({ ...f, hint: e.target.value })} data-testid="wt-hint-input" /></F>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Ikon</span>
        <div className="flex flex-wrap gap-2">{Object.entries(ICONS).map(([k, I]) => (
          <button type="button" key={k} onClick={() => setF({ ...f, icon: k })} data-testid={`wt-icon-${k}`}
            className={`w-10 h-10 rounded-lg border grid place-items-center ${f.icon === k ? "border-amber-600 bg-amber-50 text-amber-700" : "border-slate-200"}`}><I className="w-5 h-5" /></button>
        ))}</div>
      </div>
      <IconField value={f.icon_image} onChange={(icon_image) => setF({ ...f, icon_image })} testid="wt-icon-image" />
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Finishing yang berlaku & range harga per {f.unit_label || "satuan"} (Rp)</span>
        <div className="flex flex-wrap gap-2">{cfg.finishings.map((x) => <button type="button" key={x.key} onClick={() => toggleFin(x.key)} className={chip(f.finishings.includes(x.key))} data-testid={`wt-fin-${x.key}`}>{x.label}</button>)}</div>
        {cfg.finishings.filter((x) => f.finishings.includes(x.key)).map((x) => <RateRow key={x.key} fin={x} rate={f.rates[x.key]} onChange={(r) => setF({ ...f, rates: { ...f.rates, [x.key]: r } })} />)}
      </div>
    </EditDialog>
  );
};

const FinDialog = ({ init, onClose, onDone }) => {
  const [f, setF] = useState(init);
  const [busy, run] = useBusy();
  const save = () => run(async () => {
    try {
      const body = { label: f.label, desc: f.desc, active: f.active };
      if (f.key) await api.put(`/admin/custom-finishings/${f.key}`, body); else await api.post("/admin/custom-finishings", body);
      toast.success("Finishing disimpan");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  });
  return (
    <EditDialog title={f.key ? "Edit Finishing" : "Tambah Finishing"} onClose={onClose} onSave={save} busy={busy} valid={f.label.trim().length >= 2} testid="fin-dialog">
      <F label="Nama finishing"><input className={inputCls} value={f.label} maxLength={40} placeholder="mis. Melamin, ACP" onChange={(e) => setF({ ...f, label: e.target.value })} data-testid="fin-label-input" /></F>
      <F label="Deskripsi singkat"><input className={inputCls} value={f.desc} maxLength={160} onChange={(e) => setF({ ...f, desc: e.target.value })} data-testid="fin-desc-input" /></F>
      <p className="text-xs text-slate-500">Setelah ditambahkan, aktifkan finishing ini di tiap jenis pekerjaan beserta range harganya.</p>
    </EditDialog>
  );
};

const List = ({ items, kind, testid, render, onEdit, onReload, putBody, path }) => {
  const move = async (i, d) => { try { await api.post("/admin/custom-config/reorder", { kind, keys: moved(items, i, d).map((x) => x.key) }); onReload(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (x) => {
    if (!window.confirm(`Hapus "${x.label}" permanen?`)) return;
    try { await api.delete(`${path}/${x.key}`); toast.success("Dihapus"); onReload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-2">
      {items.map((x, i) => (
        <div key={x.key} className={`bg-white flex items-center gap-3 rounded-lg border px-4 py-3 ${x.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`} data-testid={`${testid}-row-${x.key}`}>
          {render(x)}
          <RowActions id={`${testid}-${x.key}`} i={i} n={items.length} active={x.active} onMove={move}
            onToggle={async (v) => { try { await api.put(`${path}/${x.key}`, { ...putBody(x), active: v }); onReload(); } catch (e) { toast.error(errMsg(e)); } }}
            onEdit={() => onEdit(x)} onDelete={() => del(x)} deleteDisabled={x.usage > 0} deleteTitle={x.usage > 0 ? "Masih dipakai proyek — nonaktifkan saja" : "Hapus"} />
        </div>
      ))}
    </div>
  );
};

const typeBody = ({ label, mode, unit_label, icon, icon_image, hint, finishings, rates, active }) => ({ label, mode, unit_label, icon, icon_image, hint, finishings, rates, active });
const Head = ({ title, desc, onAdd, testid }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div><h3 className="font-heading text-lg font-semibold">{title}</h3><p className="text-xs text-slate-500">{desc}</p></div>
    <button onClick={onAdd} data-testid={testid} className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Tambah</button>
  </div>
);

export const CustomConfigManager = () => {
  const [cfg, setCfg] = useState(null);
  const [editType, setEditType] = useState(null);
  const [editFin, setEditFin] = useState(null);
  const load = useCallback(() => { resetCustomConfig(); return api.get("/admin/custom-config").then(({ data }) => setCfg(data)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!cfg) return <div className="h-40 rounded-xl bg-[#F1EFE9] animate-pulse" />;
  const fins = Object.fromEntries(cfg.finishings.map((x) => [x.key, x.label]));
  return (
    <div className="space-y-12" data-testid="custom-config-manager">
      <section className="space-y-4">
        <Head title="Jenis Pekerjaan Custom Furniture" desc="Tampil di kalkulator & form request. Atur ikon, mode rumus ukuran, finishing dan range harga." testid="wt-add"
          onAdd={() => setEditType({ label: "", mode: "cabinet", unit_label: "meter lari", icon: "Hammer", icon_image: "", hint: "", finishings: [], rates: {}, active: true })} />
        <List items={cfg.work_types} kind="work_types" testid="wt" path="/admin/custom-work-types" putBody={typeBody} onEdit={setEditType} onReload={load}
          render={(w) => (
            <>
              <span className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 grid place-items-center shrink-0"><WorkIcon wt={w} cls="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{w.label} <span className="text-[11px] font-mono text-slate-400">· {cfg.modes[w.mode]} · {w.usage} proyek</span></div>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">{w.finishings.map((k) => <span key={k}>{fins[k]}: {rupiah(w.rates[k].min)}–{rupiah(w.rates[k].max)}/{w.unit_label}</span>)}</div>
              </div>
            </>
          )} />
      </section>
      <section className="space-y-4">
        <Head title="Pilihan Finishing" desc="mis. HPL, Duco, Melamin, ACP. Finishing nonaktif tidak tampil di kalkulator." testid="fin-add"
          onAdd={() => setEditFin({ label: "", desc: "", active: true })} />
        <List items={cfg.finishings} kind="finishings" testid="fin" path="/admin/custom-finishings" putBody={({ label, desc }) => ({ label, desc })} onEdit={setEditFin} onReload={load}
          render={(x) => <div className="flex-1 min-w-0"><div className="text-sm font-medium">{x.label} <span className="text-[11px] font-mono text-slate-400">· {x.usage} proyek</span></div><div className="text-[11px] text-slate-500 truncate">{x.desc}</div></div>} />
      </section>
      {editType && <TypeDialog init={editType} cfg={cfg} onClose={() => setEditType(null)} onDone={() => { setEditType(null); load(); }} />}
      {editFin && <FinDialog init={editFin} onClose={() => setEditFin(null)} onDone={() => { setEditFin(null); load(); }} />}
    </div>
  );
};
