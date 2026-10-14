import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";

const Btn = ({ children, ...p }) => (
  <button {...p} className="h-10 w-full rounded-full bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">{children}</button>
);

export const MilestoneAction = ({ p, m, i, viewer, onChange }) => {
  const [note, setNote] = useState("");
  const prevDone = i === 0 || p.milestones[i - 1].status === "released";
  const call = async (action, body, msg) => {
    try {
      const { data } = await api.post(`/custom/projects/${p.project_id}/milestones/${m.key}/${action}`, body);
      toast.success(msg);
      onChange(data);
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (viewer === "client") {
    if (m.status === "pending" && prevDone)
      return <Btn data-testid={`milestone-pay-${m.key}`} onClick={() => call("pay", undefined, "Dana milestone ditahan escrow")}>Bayar {rupiah(m.amount)} ke Escrow</Btn>;
    if (m.status === "submitted")
      return <Btn data-testid={`milestone-release-${m.key}`} onClick={() => call("release", undefined, "Milestone disetujui, dana dirilis ke vendor")}>Setujui & Rilis Dana</Btn>;
  }
  if (viewer === "vendor" && m.status === "held")
    return (
      <div className="space-y-2">
        <input data-testid={`milestone-note-${m.key}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Laporan progres / bukti pekerjaan"
          className="w-full h-10 px-3 rounded-full border border-slate-300 text-sm outline-none focus:border-amber-600" />
        <Btn data-testid={`milestone-submit-${m.key}`} disabled={note.trim().length < 3} onClick={() => call("submit", { note }, "Laporan dikirim ke klien")}>Laporkan Selesai</Btn>
      </div>
    );
  return null;
};
