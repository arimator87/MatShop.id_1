import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";

const Row = ({ p, vendorId, onInvited }) => {
  const [busy, setBusy] = useState(false);
  const done = (p.invited_vendor_ids || []).includes(vendorId);
  const invite = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/custom/projects/${p.project_id}/invite`, { vendor_id: vendorId });
      onInvited({ ...p, invited_vendor_ids: data.invited_vendor_ids });
      toast.success("Undangan terkirim ke vendor");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg p-3" data-testid={`invite-row-${p.project_id}`}>
      <div className="min-w-0">
        <div className="font-medium line-clamp-1">{p.title}</div>
        <div className="text-xs text-slate-500 font-mono">{p.project_id} · {p.work_type_label} · {p.city} · {rupiah(p.budget ?? p.estimate_max)}</div>
      </div>
      {done ? (
        <span className="text-xs text-green-700 inline-flex items-center gap-1 shrink-0" data-testid={`invite-done-${p.project_id}`}><Check className="w-4 h-4" /> Diundang</span>
      ) : (
        <button onClick={invite} disabled={busy} data-testid={`invite-button-${p.project_id}`}
          className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 hover:bg-amber-700 disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Undang
        </button>
      )}
    </div>
  );
};

export const InviteDialog = ({ v, onClose }) => {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get("/custom/projects/mine").then(({ data }) => setItems(data.filter((p) => p.status === "open"))); }, []);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" data-testid="invite-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Undang {v.business_name}</DialogTitle>
          <DialogDescription>Pilih proyek Anda yang berstatus OPEN_FOR_BID. Vendor akan menerima notifikasi untuk mengajukan penawaran.</DialogDescription>
        </DialogHeader>
        {!items ? <div className="h-24 rounded-lg bg-[#F1EFE9] animate-pulse" /> : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 space-y-3" data-testid="invite-empty">
            <p>Belum ada proyek Anda yang terbuka untuk penawaran.</p>
            <Link to="/custom-project/ajukan" onClick={onClose} className="inline-flex h-10 px-5 rounded-full bg-amber-600 text-white font-semibold items-center">Ajukan Proyek Custom</Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto" data-testid="invite-list">
            {items.map((p) => <Row key={p.project_id} p={p} vendorId={v.user_id} onInvited={(np) => setItems(items.map((x) => (x.project_id === np.project_id ? np : x)))} />)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
