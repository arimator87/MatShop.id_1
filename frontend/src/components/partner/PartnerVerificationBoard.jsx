import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ExternalLink, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, imgSrc } from "@/lib/api";
import { fmtSurvey, mapsLink } from "@/lib/partner";
import { MapPreview } from "@/components/partner/LocationPicker";
import { PartnerChip } from "@/components/partner/PartnerStatus";

const ROLES = [["designer_creator", "Desainer"], ["contractor", "Kontraktor"]];
const FILTERS = [["pending", "Pending"], ["scheduled", "Survei Dijadwalkan"], ["verified", "Terverifikasi"], ["rejected", "Ditolak"], ["all", "Semua"]];
const pill = (on) => `h-9 px-4 rounded-full text-sm border transition-colors ${on ? "bg-[#1E242B] text-white border-[#1E242B]" : "bg-white border-slate-200 hover:border-slate-400"}`;
const cls = "h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-amber-600";

const Doc = ({ label, src, testid }) => (
  <a href={imgSrc(src)} target="_blank" rel="noopener noreferrer" className="block space-y-1" data-testid={testid}>
    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[#F1EFE9] border">{src && <img src={imgSrc(src)} alt={label} className="w-full h-full object-cover" />}</div>
    <div className="text-[11px] text-slate-500">{label}</div>
  </a>
);

const Actions = ({ v, role, onDone }) => {
  const [mode, setMode] = useState(null);
  const [f, setF] = useState({ date: v.reschedule_request?.preferred_date || "", time: v.reschedule_request?.preferred_time || "09:00", note: "" });
  const [busy, setBusy] = useState(false);
  const run = async (path, body, msg) => {
    setBusy(true);
    try { await api.post(`/admin/partner-verifications/${v.user_id}/${path}`, body); toast.success(msg); onDone(); } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const id = v.user_id;
  if (v.status === "VERIFIED") return <div className="text-xs text-green-700">Disetujui {v.decided_by}{v.seeded ? " (data demo)" : ""}</div>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {role === "contractor" && <button onClick={() => setMode("schedule")} data-testid={`pv-schedule-${id}`} className="h-10 px-4 rounded-full bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> {v.survey ? "Jadwalkan Ulang" : "Jadwalkan Survei"}</button>}
        {(role !== "contractor" || v.status === "SURVEY_SCHEDULED") && (
          <button disabled={busy} onClick={() => run(`${role}/approve`, {}, "Partner disetujui")} data-testid={`pv-approve-${id}`}
            className="h-10 px-4 rounded-full bg-green-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><ShieldCheck className="w-4 h-4" /> {role === "contractor" ? "Approve (Verified Partner)" : "Approve"}</button>
        )}
        {v.status !== "REJECTED" && <button onClick={() => setMode("reject")} data-testid={`pv-reject-${id}`} className="h-10 px-4 rounded-full border border-red-300 text-red-700 text-sm font-semibold inline-flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Tolak</button>}
      </div>
      {mode === "schedule" && (
        <div className="flex flex-wrap gap-2" data-testid={`pv-schedule-form-${id}`}>
          <input type="date" className={cls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid={`pv-date-${id}`} />
          <input type="time" className={cls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} data-testid={`pv-time-${id}`} />
          <input className={`${cls} flex-1 min-w-[180px]`} placeholder="Catatan (nama surveyor, CP)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid={`pv-note-${id}`} />
          <button disabled={busy || !f.date || !f.time} onClick={() => run("contractor/schedule", f, "Jadwal survei dikirim ke kontraktor")} data-testid={`pv-schedule-save-${id}`}
            className="h-10 px-4 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Jadwal</button>
        </div>
      )}
      {mode === "reject" && (
        <div className="flex flex-wrap gap-2">
          <input className={`${cls} flex-1 min-w-[220px]`} placeholder="Alasan penolakan (wajib)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid={`pv-reject-note-${id}`} />
          <button disabled={busy || f.note.trim().length < 5} onClick={() => run(`${role}/reject`, { note: f.note }, "Pengajuan ditolak")} data-testid={`pv-reject-save-${id}`}
            className="h-10 px-4 rounded-full bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Kirim Penolakan</button>
        </div>
      )}
    </div>
  );
};

const Card = ({ v, role, onDone }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4" data-testid={`pv-card-${v.user_id}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><div className="font-heading font-semibold">{v.business_name || v.name}</div><div className="text-xs text-slate-500">{v.name} · {v.email} · diajukan {new Date(v.submitted_at).toLocaleDateString("id-ID")}</div></div>
      <PartnerChip status={v.status} testid={`pv-status-${v.user_id}`} />
    </div>
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
      <Doc label="KTP" src={v.ktp} testid={`pv-ktp-${v.user_id}`} />
      <Doc label="Foto Diri" src={v.selfie} testid={`pv-selfie-${v.user_id}`} />
      {(v.workshop_photos || []).slice(0, 3).map((p, i) => <Doc key={p + i} label={`Workshop ${i + 1}`} src={p} />)}
    </div>
    {role === "contractor" && v.address && (
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1.5">
          <div><span className="text-slate-500">Alamat:</span> {v.address}</div>
          <a href={v.workshop_video} target="_blank" rel="noopener noreferrer" className="text-amber-700 inline-flex items-center gap-1" data-testid={`pv-video-${v.user_id}`}>Video workshop <ExternalLink className="w-3.5 h-3.5" /></a>
          {mapsLink(v) && <a href={mapsLink(v)} target="_blank" rel="noopener noreferrer" className="block text-amber-700" data-testid={`pv-maps-${v.user_id}`}>Buka di Google Maps</a>}
          {v.survey && <div className="text-blue-800" data-testid={`pv-survey-${v.user_id}`}>Survei: {fmtSurvey(v.survey)}{v.survey.note && ` · ${v.survey.note}`}</div>}
          {v.survey_history?.length > 0 && <div className="text-xs text-slate-500">Riwayat jadwal: {v.survey_history.map((s) => `${s.date} ${s.time}`).join(", ")}</div>}
          {v.reschedule_request && <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 p-2" data-testid={`pv-reschedule-${v.user_id}`}>Kontraktor minta jadwal ulang: <b>{v.reschedule_request.preferred_date} {v.reschedule_request.preferred_time}</b> — {v.reschedule_request.reason}</div>}
        </div>
        {v.lat != null && <MapPreview lat={v.lat} lng={v.lng} cls="h-40" testid={`pv-map-${v.user_id}`} />}
      </div>
    )}
    {v.note && v.status === "REJECTED" && <div className="text-xs text-red-700">Alasan ditolak: {v.note}</div>}
    <Actions v={v} role={role} onDone={onDone} />
  </div>
);

export const PartnerVerificationBoard = () => {
  const [role, setRole] = useState("designer_creator");
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState(null);
  const [counts, setCounts] = useState(null);
  const load = useCallback(() => {
    api.get("/admin/partner-verifications", { params: { role, status } }).then(({ data }) => setItems(data)).catch(() => setItems([]));
    api.get("/admin/partner-verifications/counts").then(({ data }) => setCounts(data)).catch(() => {});
  }, [role, status]);
  useEffect(() => { load(); }, [load]);
  return (
    <section className="space-y-5" data-testid="partner-verification-board">
      <div className="flex flex-wrap gap-2">
        {ROLES.map(([k, l]) => (
          <button key={k} onClick={() => { setRole(k); setStatus("pending"); }} data-testid={`pv-role-${k}`}
            className={`h-11 px-5 rounded-full font-semibold text-sm border-2 transition-colors ${role === k ? "border-amber-600 bg-amber-50 text-amber-800" : "border-slate-200 bg-white"}`}>
            {l} Pending <span className="ml-1 font-mono">({counts?.[k]?.pending ?? 0})</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.filter(([k]) => role === "contractor" || k !== "scheduled").map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={pill(status === k)} data-testid={`pv-filter-${k}`}>{l}{counts?.[role]?.[k] != null && ` (${counts[role][k]})`}</button>
        ))}
      </div>
      {!items ? <div className="h-32 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0
        ? <div className="py-12 text-center border border-dashed rounded-xl text-slate-500" data-testid="pv-empty">Tidak ada pengajuan.</div>
        : <div className="space-y-4">{items.map((v) => <Card key={v.user_id} v={v} role={role} onDone={load} />)}</div>}
    </section>
  );
};
