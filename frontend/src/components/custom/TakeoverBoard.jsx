import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/custom";
import { ProgressBars } from "@/components/custom/ProjectProgress";

const TakeoverDialog = ({ p, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const held = p.milestones.filter((m) => ["held", "submitted"].includes(m.status)).reduce((s, m) => s + m.amount, 0);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/custom/admin/projects/${p.project_id}/takeover`, { reason });
      toast.success("INTERNAL_TAKEOVER aktif. Klien menerima notifikasi garansi");
      onDone();
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="takeover-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Initiate Master Workshop Takeover</DialogTitle>
          <DialogDescription>{p.project_id} · {p.title}</DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-1.5 bg-red-50 border border-red-200 rounded-lg p-4 text-red-900">
          <li>1. Status proyek menjadi <b className="font-mono">INTERNAL_TAKEOVER</b></li>
          <li>2. Sisa dana escrow <b className="font-mono">{rupiah(held)}</b> dialihkan ke Master Workshop MatShop</li>
          <li>3. Akun <b>{p.vendor_name}</b> dibekukan (suspend)</li>
          <li>4. Klien menerima notifikasi garansi penyelesaian proyek</li>
        </ul>
        <textarea data-testid="takeover-reason-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan wanprestasi (min. 10 karakter)"
          className="w-full h-24 p-3 rounded-lg border border-slate-300 outline-none focus:border-red-500 text-sm" />
        <button data-testid="takeover-confirm" onClick={submit} disabled={busy || reason.trim().length < 10}
          className="h-11 rounded-full bg-red-600 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Aktifkan Takeover
        </button>
      </DialogContent>
    </Dialog>
  );
};

const SuspendedList = ({ users, onChange }) => {
  if (!users.length) return null;
  const unsuspend = async (id) => {
    try { await api.post(`/admin/users/${id}/unsuspend`); toast.success("Akun diaktifkan kembali"); onChange(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="bg-white rounded-xl border border-red-200 p-5 space-y-3" data-testid="suspended-users">
      <div className="font-heading font-semibold text-red-700">Akun Kontraktor Dibekukan</div>
      {users.map((u) => (
        <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid={`suspended-${u.user_id}`}>
          <div><b>{u.name}</b> <span className="text-slate-500">· {u.suspended_reason}</span></div>
          <button onClick={() => unsuspend(u.user_id)} data-testid={`unsuspend-${u.user_id}`}
            className="h-9 px-4 rounded-full border border-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-slate-900"><UserCheck className="w-3.5 h-3.5" /> Cabut Suspend</button>
        </div>
      ))}
    </div>
  );
};

export const TakeoverBoard = () => {
  const [items, setItems] = useState(null);
  const [suspended, setSuspended] = useState([]);
  const [target, setTarget] = useState(null);
  const load = useCallback(() => {
    api.get("/custom/admin/active-projects").then(({ data }) => setItems(data));
    api.get("/admin/suspended-users").then(({ data }) => setSuspended(data));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  return (
    <div className="space-y-5" data-testid="takeover-board">
      <SuspendedList users={suspended} onChange={load} />
      {!items ? <div className="h-32 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid="monitor-empty">Belum ada proyek berjalan.</div>
      ) : items.map((p) => {
        const st = PROJECT_STATUS[p.status];
        return (
          <div key={p.project_id} className={`bg-white rounded-xl border p-5 space-y-4 ${p.status === "internal_takeover" ? "border-red-300" : "border-slate-200"}`} data-testid={`monitor-card-${p.project_id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{p.project_id} · Klien {p.client_name}</div>
                <Link to={`/custom-project/${p.project_id}`} className="font-heading font-semibold text-lg hover:text-amber-700">{p.title}</Link>
                <div className="text-sm text-slate-600">Pelaksana: <b>{p.vendor_name}</b>{p.original_vendor_name && <> (sebelumnya {p.original_vendor_name})</>} · Kontrak {rupiah(p.contract_amount)}</div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.cls}`} data-testid={`monitor-status-${p.project_id}`}><span className="font-mono">{st.code}</span></span>
            </div>
            <ProgressBars p={p} compact />
            {["awarded", "in_progress"].includes(p.status) && (
              <button onClick={() => setTarget(p)} data-testid={`takeover-btn-${p.project_id}`}
                className="h-10 px-4 rounded-full bg-red-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-red-700"><AlertOctagon className="w-4 h-4" /> Initiate Master Workshop Takeover</button>
            )}
            {p.takeover && (
              <div className="text-xs text-red-800 bg-red-50 rounded-md p-3 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" />
                Dana escrow {rupiah(p.takeover.escrow_transferred)} dialihkan ke Master Workshop · sisa belum dibayar {rupiah(p.takeover.remaining_unpaid)} · {p.takeover.reason}</div>
            )}
          </div>
        );
      })}
      {target && <TakeoverDialog p={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); load(); }} />}
    </div>
  );
};
