import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";

export const REPORT_REASONS = { spam: "Spam", abusive: "Kata kasar", not_client: "Bukan klien saya", false_info: "Info palsu", other: "Lainnya" };
const STATUS = { pending: ["Dilaporkan · menunggu tinjauan admin", "bg-amber-100 text-amber-800"], rejected: ["Laporan ditolak admin", "bg-slate-100 text-slate-600"], hidden: ["Disembunyikan", "bg-red-100 text-red-700"] };

const ReportDialog = ({ r, onClose, onSaved }) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/reviews/${r.review_id}/report`, { reason, note });
      onSaved(data);
      toast.success("Laporan dikirim ke tim MatShop");
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="report-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Laporkan Ulasan</DialogTitle>
          <DialogDescription>Ulasan tetap tampil selama ditinjau admin. Anda akan menerima notifikasi hasilnya.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {Object.entries(REPORT_REASONS).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setReason(k)} data-testid={`report-reason-${k}`}
              className={`text-sm px-4 py-2 rounded-full border transition-colors ${reason === k ? "bg-[#1E242B] text-white border-[#1E242B]" : "border-slate-300 hover:border-slate-500"}`}>{l}</button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} data-testid="report-note-input"
          placeholder="Keterangan tambahan (opsional)" className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
        <button onClick={submit} disabled={busy || !reason} data-testid="report-submit"
          className="h-11 rounded-full bg-red-600 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Kirim Laporan
        </button>
      </DialogContent>
    </Dialog>
  );
};

export const ReviewReport = ({ r, onSaved }) => {
  const [open, setOpen] = useState(false);
  if (r.report) {
    const [label, cls] = STATUS[r.report.status];
    return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`} data-testid={`report-status-${r.review_id}`}>{label}</span>;
  }
  return (
    <>
      <button onClick={() => setOpen(true)} data-testid={`report-button-${r.review_id}`} className="text-xs text-slate-500 hover:text-red-600 inline-flex items-center gap-1"><Flag className="w-3.5 h-3.5" /> Laporkan</button>
      {open && <ReportDialog r={r} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
};
