import { useState } from "react";
import { Check, Loader2, MailOpen, X } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

export const INVITE_STATUS = {
  pending: { label: "Menunggu", cls: "bg-amber-100 text-amber-800" },
  accepted: { label: "Diterima", cls: "bg-green-100 text-green-800" },
  declined: { label: "Ditolak", cls: "bg-slate-200 text-slate-600" },
};

const Chip = ({ s, testid }) => <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${INVITE_STATUS[s].cls}`} data-testid={testid}>{INVITE_STATUS[s].label}</span>;

export const ClientInvitations = ({ items }) => (
  <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3" data-testid="client-invitations">
    <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><MailOpen className="w-5 h-5 text-amber-600" /> Vendor yang Diundang ({items.length})</h2>
    {items.map((i) => (
      <div key={i.vendor_id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-slate-100 pt-3" data-testid={`invitation-${i.vendor_id}`}>
        <div><b>{i.vendor_name || i.vendor_id}</b>{i.status === "declined" && i.reason && <span className="text-slate-500"> · Alasan: {i.reason}</span>}</div>
        <Chip s={i.status} testid={`invitation-status-${i.vendor_id}`} />
      </div>
    ))}
  </section>
);

export const VendorInvitation = ({ p, inv, onChange }) => {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const respond = async (accept) => {
    setBusy(true);
    try {
      await api.post(`/custom/projects/${p.project_id}/invitation/respond`, { accept, reason });
      toast.success(accept ? "Undangan diterima. Silakan ajukan penawaran." : "Undangan ditolak");
      onChange();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  if (inv.status !== "pending") return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm flex items-center gap-2" data-testid="vendor-invitation-done">
      Undangan klien: <Chip s={inv.status} testid="vendor-invitation-status" />
    </div>
  );
  return (
    <section className="rounded-xl border-2 border-amber-500 bg-amber-50/60 p-5 space-y-3" data-testid="vendor-invitation">
      <div className="font-heading font-semibold flex items-center gap-2"><MailOpen className="w-5 h-5 text-amber-600" /> Anda diundang klien untuk menawar proyek ini</div>
      {declining && (
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} data-testid="invitation-decline-reason"
          placeholder="Alasan menolak (opsional), mis. jadwal workshop penuh" className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm bg-white" />
      )}
      <div className="flex flex-wrap gap-2">
        {!declining && <button onClick={() => respond(true)} disabled={busy} data-testid="invitation-accept"
          className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Terima & Ajukan Penawaran</button>}
        {declining
          ? <button onClick={() => respond(false)} disabled={busy} data-testid="invitation-decline-confirm" className="h-10 px-5 rounded-full bg-red-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Konfirmasi Tolak</button>
          : <button onClick={() => setDeclining(true)} data-testid="invitation-decline" className="h-10 px-5 rounded-full border border-slate-300 bg-white text-sm font-semibold inline-flex items-center gap-1.5"><X className="w-4 h-4" /> Tolak</button>}
        {declining && <button onClick={() => setDeclining(false)} className="h-10 px-4 text-sm text-slate-600" data-testid="invitation-decline-cancel">Batal</button>}
      </div>
    </section>
  );
};
