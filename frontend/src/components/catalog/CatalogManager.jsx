import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { resetCatalogTabs } from "@/components/CatalogTabs";
import { CategoryManager } from "@/components/catalog/CategoryManager";
import { EditDialog, Icon, IconField, inputCls, moved, RowActions, TYPE_NAMES, useBusy } from "@/components/catalog/shared";

const chip = (on) => `text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300 hover:border-slate-500"}`;
const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const TabDialog = ({ init, categories, onClose, onDone }) => {
  const [f, setF] = useState(init);
  const [busy, run] = useBusy();
  const save = () => run(async () => {
    try {
      const body = { label: f.label, types: f.types, categories: f.categories, icon: f.icon || "", active: f.active };
      if (f.key) await api.put(`/admin/tabs/${f.key}`, body); else await api.post("/admin/tabs", body);
      toast.success("Tab katalog disimpan");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  });
  return (
    <EditDialog title={f.key ? "Edit Tab Katalog" : "Tambah Tab Katalog"} onClose={onClose} onSave={save} busy={busy}
      valid={f.label.trim().length >= 2 && (f.types.length || f.categories.length)} testid="tab-dialog">
      <input className={inputCls} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Nama tab, mis. Plywood & Sheet" maxLength={50} data-testid="tab-label-input" />
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Tampilkan semua produk dari jenis</span>
        <div className="flex flex-wrap gap-2">{Object.entries(TYPE_NAMES).map(([k, l]) => (
          <button type="button" key={k} onClick={() => setF({ ...f, types: toggleIn(f.types, k) })} className={chip(f.types.includes(k))} data-testid={`tab-type-${k}`}>Semua {l}</button>
        ))}</div>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Dan/atau kategori tertentu</span>
        {Object.entries(TYPE_NAMES).map(([t, l]) => (
          <div key={t} className="space-y-1">
            <div className="text-[11px] font-mono uppercase text-slate-400">{l}</div>
            <div className="flex flex-wrap gap-2">{categories.filter((c) => c.type === t).map((c) => (
              <button type="button" key={c.key} onClick={() => setF({ ...f, categories: toggleIn(f.categories, c.key) })} className={chip(f.categories.includes(c.key))} data-testid={`tab-cat-${c.key}`}>{c.label}</button>
            ))}</div>
          </div>
        ))}
      </div>
      <IconField value={f.icon} onChange={(icon) => setF({ ...f, icon })} testid="tab-icon" />
      <p className="text-xs text-slate-500">Jika ikon tab kosong, dipakai ikon kategori pertama yang dipilih.</p>
    </EditDialog>
  );
};

const TabList = ({ tabs, categories, onReload, onEdit }) => {
  const names = Object.fromEntries(categories.map((c) => [c.key, c.label]));
  const put = (t, patch) => api.put(`/admin/tabs/${t.key}`, { label: t.label, types: t.types, categories: t.categories, icon: t.icon, active: t.active, ...patch });
  const move = async (i, d) => { try { await api.post("/admin/catalog/reorder", { kind: "tabs", keys: moved(tabs, i, d).map((t) => t.key) }); onReload(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (t) => {
    if (!window.confirm(`Hapus tab "${t.label}"?`)) return;
    try { await api.delete(`/admin/tabs/${t.key}`); onReload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-2" data-testid="tab-list">
      {tabs.map((t, i) => (
        <div key={t.key} className={`bg-white flex items-center gap-3 rounded-lg border px-4 py-3 ${t.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`} data-testid={`tab-row-${t.key}`}>
          <span className="font-mono text-xs w-5">{i + 1}</span>
          <Icon src={t.icon} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{t.label}</div>
            <div className="text-[11px] text-slate-500 truncate">{[...t.types.map((x) => `Semua ${TYPE_NAMES[x]}`), ...t.categories.map((c) => names[c] || c)].join(" · ")}</div>
          </div>
          <RowActions id={`tab-${t.key}`} i={i} n={tabs.length} active={t.active} onMove={move}
            onToggle={async (v) => { try { await put(t, { active: v }); onReload(); } catch (e) { toast.error(errMsg(e)); } }}
            onEdit={() => onEdit(t)} onDelete={() => del(t)} />
        </div>
      ))}
    </div>
  );
};

export const CatalogManager = () => {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => { resetCatalogTabs(); return api.get("/admin/catalog").then(({ data }) => setData(data)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <div className="h-40 rounded-xl bg-[#F1EFE9] animate-pulse" />;
  return (
    <div className="space-y-12" data-testid="catalog-manager">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-semibold">Tab Katalog</h3>
            <p className="text-xs text-slate-500">Tab yang tampil di halaman Katalog & Beranda. Atur nama, isi kategori, urutan, dan aktif/nonaktif.</p>
          </div>
          <button onClick={() => setEditing({ label: "", types: [], categories: [], icon: "", active: true })} data-testid="tab-add"
            className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Tab Baru</button>
        </div>
        <TabList tabs={data.tabs} categories={data.categories} onReload={load} onEdit={setEditing} />
      </section>
      <CategoryManager categories={data.categories} onReload={load} />
      {editing && <TabDialog init={editing} categories={data.categories} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
};
