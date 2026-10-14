import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { imgSrc } from "@/lib/api";
import { ImagesField } from "@/components/ListingForm";

export const TYPE_NAMES = { material: "Material", service: "Jasa Desain", asset: "Aset 3D" };
export const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";

export const IconField = ({ value, onChange, testid }) => (
  <div className="space-y-1.5">
    <span className="text-sm font-medium text-slate-700">Ikon (opsional) — 200 × 200 px (1:1), PNG/JPG/WebP</span>
    <ImagesField images={value ? [value] : []} onChange={(x) => onChange(x[x.length - 1] || "")} testid={testid} />
  </div>
);

export const Icon = ({ src }) => (src
  ? <img src={imgSrc(src)} alt="" className="w-9 h-9 rounded-full object-cover bg-[#F1EFE9] shrink-0" />
  : <span className="w-9 h-9 rounded-full bg-[#F1EFE9] shrink-0" />);

export const RowActions = ({ id, i, n, active, onMove, onToggle, onEdit, onDelete, deleteDisabled, deleteTitle }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <button type="button" disabled={i === 0} onClick={() => onMove(i, -1)} data-testid={`${id}-up`} className="w-7 h-7 rounded-full border grid place-items-center disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
    <button type="button" disabled={i === n - 1} onClick={() => onMove(i, 1)} data-testid={`${id}-down`} className="w-7 h-7 rounded-full border grid place-items-center disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
    <Switch checked={active} onCheckedChange={onToggle} data-testid={`${id}-toggle`} />
    <button type="button" onClick={onEdit} data-testid={`${id}-edit`} className="w-7 h-7 grid place-items-center text-slate-600 hover:text-slate-900"><Pencil className="w-4 h-4" /></button>
    <button type="button" onClick={onDelete} disabled={deleteDisabled} title={deleteTitle} data-testid={`${id}-delete`}
      className="w-7 h-7 grid place-items-center text-red-600 hover:text-red-800 disabled:text-slate-300 disabled:cursor-not-allowed"><Trash2 className="w-4 h-4" /></button>
  </div>
);

export const EditDialog = ({ title, onClose, onSave, valid, busy, children, testid }) => (
  <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid={testid}>
      <DialogHeader><DialogTitle className="font-heading text-xl">{title}</DialogTitle></DialogHeader>
      <div className="space-y-4">{children}</div>
      <button onClick={onSave} disabled={busy || !valid} data-testid={`${testid}-save`}
        className="h-11 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
      </button>
    </DialogContent>
  </Dialog>
);

export const useBusy = () => {
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return [busy, run];
};

export const moved = (list, i, d) => { const n = [...list]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; };
