import { useState } from "react";
import { CalendarClock, Clock, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CONTRACTOR_MSG, fmtSurvey, PARTNER_STATUS } from "@/lib/partner";

export const PartnerChip = ({ status, testid }) => {
  const m = PARTNER_STATUS[status];
  return m ? <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${m.cls}`} data-testid={testid}>{m.label}</span> : null;
};

const RescheduleForm = ({ req }) => {
  const { setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ preferred_date: "", preferred_time: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/users/activation/contractor/reschedule", f);
      setUser(data);
      toast.success("Permintaan jadwal ulang dikirim ke tim MatShop");
      setOpen(false);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  if (req) return <p className="text-xs text-blue-800" data-testid="reschedule-pending">Permintaan jadwal ulang ({req.preferred_date} {req.preferred_time}) sedang diproses admin.</p>;
  if (!open) return <button onClick={() => setOpen(true)} data-testid="reschedule-open" className="text-sm font-semibold text-blue-800 underline underline-offset-2">Tidak bisa di waktu ini? Ajukan jadwal ulang</button>;
  const cls = "h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-amber-600";
  return (
    <div className="grid sm:grid-cols-[auto_auto_1fr_auto] gap-2 items-center" data-testid="reschedule-form">
      <input type="date" className={cls} value={f.preferred_date} onChange={(e) => setF({ ...f, preferred_date: e.target.value })} data-testid="reschedule-date" />
      <input type="time" className={cls} value={f.preferred_time} onChange={(e) => setF({ ...f, preferred_time: e.target.value })} data-testid="reschedule-time" />
      <input className={cls} placeholder="Alasan, mis. sedang ada pemasangan di luar kota" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} data-testid="reschedule-reason" />
      <button onClick={submit} disabled={busy || !f.preferred_date || f.reason.trim().length < 5} data-testid="reschedule-submit"
        className="h-10 px-4 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Kirim</button>
    </div>
  );
};

const TEXT = {
  PENDING_DESIGNER_VERIFICATION: "Dokumen KTP & foto diri Anda sedang ditinjau tim MatShop.id. Anda tetap bisa memakai fitur Desainer; badge \"Belum Terverifikasi\" tampil sampai disetujui.",
  PENDING_SURVEY_VERIFICATION: CONTRACTOR_MSG,
};

export const PartnerStatusCard = ({ role, v, onResubmit, testid = "partner-status" }) => {
  const s = v.status;
  const tone = s === "VERIFIED" ? "border-green-300 bg-green-50" : s === "REJECTED" ? "border-red-300 bg-red-50" : s === "SURVEY_SCHEDULED" ? "border-blue-300 bg-blue-50" : "border-amber-300 bg-amber-50";
  const Icon = s === "VERIFIED" ? ShieldCheck : s === "REJECTED" ? XCircle : s === "SURVEY_SCHEDULED" ? CalendarClock : Clock;
  return (
    <div className={`rounded-xl border-2 p-5 flex gap-4 ${tone}`} data-testid={testid} data-status={s}>
      <Icon className="w-6 h-6 shrink-0 text-slate-700" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex flex-wrap items-center gap-2"><b className="font-heading">Status verifikasi {role === "contractor" ? "Kontraktor / Workshop" : "Desainer"}</b><PartnerChip status={s} testid={`${testid}-chip`} /></div>
        {TEXT[s] && <p className="text-sm text-slate-700" data-testid={`${testid}-message`}>{TEXT[s]}</p>}
        {s === "SURVEY_SCHEDULED" && (
          <div className="space-y-2">
            <p className="text-sm text-slate-800" data-testid={`${testid}-survey`}>Kunjungan survei workshop: <b>{fmtSurvey(v.survey)}</b>{v.survey.note && ` — ${v.survey.note}`}</p>
            <RescheduleForm req={v.reschedule_request} />
          </div>
        )}
        {s === "VERIFIED" && <p className="text-sm text-green-800">Selamat, Anda Verified Partner MatShop.id. Badge terverifikasi tampil di profil & penawaran Anda.</p>}
        {s === "REJECTED" && (
          <div className="space-y-2">
            <p className="text-sm text-red-800">Alasan: {v.note}</p>
            {onResubmit && <button onClick={onResubmit} data-testid={`${testid}-resubmit`} className="h-9 px-4 rounded-full bg-[#1E242B] text-white text-sm font-semibold">Perbaiki & Kirim Ulang</button>}
          </div>
        )}
      </div>
    </div>
  );
};
