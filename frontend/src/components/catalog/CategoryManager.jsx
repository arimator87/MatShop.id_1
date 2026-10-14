import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { EditDialog, Icon, IconField, inputCls, moved, RowActions, TYPE_NAMES, useBusy } from "@/components/catalog/shared";

const CatDialog = ({ init, onClose, onDone }) => {
  const [f, setF] = useState(init);
  const [busy, run] = useBusy();
  const save = () => run(async () => {
    try {
      const body = { type: f.type, label: f.label, icon: f.icon || "", active: f.active };
      if (f.key) await api.put(`/admin/categories/${f.key}`, body); else await api.post("/admin/categories", body);
      toast.success("Kategori disimpan");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  });
  return (
    <EditDialog title={`${f.key ? "Edit" : "Tambah"} Kategori ${TYPE_NAMES[f.type]}`} onClose={onClose} onSave={save} busy={busy} valid={f.label.trim().length >= 2} testid="category-dialog">
      <input className={inputCls} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Nama kategori" maxLength={50} data-testid="category-label-input" />
      <IconField value={f.icon} onChange={(icon) => setF({ ...f, icon })} testid="category-icon" />
    </EditDialog>
  );
};

const TypeColumn = ({ type, items, onReload, onEdit }) => {
  const put = (c, patch) => api.put(`/admin/categories/${c.key}`, { type: c.type, label: c.label, icon: c.icon, active: c.active, ...patch });
  const move = async (i, d) => {
    try { await api.post("/admin/catalog/reorder", { kind: "categories", keys: moved(items, i, d).map((c) => c.key) }); onReload(); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (c) => {
    if (!window.confirm(`Hapus kategori "${c.label}" permanen?`)) return;
    try { await api.delete(`/admin/categories/${c.key}`); toast.success("Kategori dihapus"); onReload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3" data-testid={`category-column-${type}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-heading font-semibold">{TYPE_NAMES[type]}</h4>
        <button onClick={() => onEdit({ type, label: "", icon: "", active: true })} data-testid={`category-add-${type}`}
          className="h-8 px-3 rounded-full bg-[#1E242B] text-white text-xs font-semibold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Tambah</button>
      </div>
      {items.map((c, i) => (
        <div key={c.key} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${c.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`} data-testid={`category-row-${c.key}`}>
          <Icon src={c.icon} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{c.label}</div>
            <div className="text-[11px] text-slate-500 font-mono" data-testid={`category-usage-${c.key}`}>{c.usage} produk{!c.active && " · nonaktif"}</div>
          </div>
          <RowActions id={`category-${c.key}`} i={i} n={items.length} active={c.active} onMove={move}
            onToggle={async (v) => { try { await put(c, { active: v }); onReload(); } catch (e) { toast.error(errMsg(e)); } }}
            onEdit={() => onEdit(c)} onDelete={() => del(c)} deleteDisabled={c.usage > 0} deleteTitle={c.usage > 0 ? "Masih dipakai produk — nonaktifkan saja" : "Hapus"} />
        </div>
      ))}
    </div>
  );
};

export const CategoryManager = ({ categories, onReload }) => {
  const [editing, setEditing] = useState(null);
  return (
    <section className="space-y-4" data-testid="category-manager">
      <div>
        <h3 className="font-heading text-lg font-semibold">Kategori per Jenis</h3>
        <p className="text-xs text-slate-500">Dipakai vendor saat membuat listing. Kategori yang masih dipakai produk hanya bisa dinonaktifkan (tidak muncul di form listing baru).</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {Object.keys(TYPE_NAMES).map((t) => <TypeColumn key={t} type={t} items={categories.filter((c) => c.type === t)} onReload={onReload} onEdit={setEditing} />)}
      </div>
      {editing && <CatDialog init={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onReload(); }} />}
    </section>
  );
};
