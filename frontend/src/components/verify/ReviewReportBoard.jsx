import { useCallback, useEffect, useState } from "react";
import { EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Stars } from "@/components/Stars";

const FILTERS = [["pending", "Menunggu"], ["hidden", "Disembunyikan"], ["rejected", "Ditolak"], ["all", "Semua"]];

const ReportCard = ({ r, onDone }) => {
  const [note, setNote] = useState("");
  const act = async (action) => {
    try {
      await api.post(`/admin/review-reports/${r.review_id}/resolve`, { action, note });
      toast.success(action === "hide" ? "Ulasan disembunyikan" : "Laporan ditolak");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3" data-testid={`report-card-${r.review_id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-medium">Alasan: {r.report.reason_label}</span>
        <span className="text-xs text-slate-500">Pelapor: {r.report.reporter_name} · {new Date(r.report.at).toLocaleDateString("id-ID")}</span>
      </div>
      {r.report.note && <p className="text-sm text-slate-600">Keterangan vendor: {r.report.note}</p>}
      <div className="bg-[#F8F7F4] rounded-lg p-3 space-y-1 text-sm">
        <Stars value={r.rating} size="w-3.5 h-3.5" />
        <p className="text-slate-700">"{r.comment}"</p>
        <div className="text-xs text-slate-500">{r.reviewer_name} · {r.subject}</div>
      </div>
      {r.report.status === "pending" ? (
        <div className="space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan untuk vendor (opsional)" data-testid={`report-admin-note-${r.review_id}`}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => act("hide")} data-testid={`report-hide-${r.review_id}`} className="h-10 px-4 rounded-full bg-red-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"><EyeOff className="w-4 h-4" /> Sembunyikan Ulasan</button>
            <button onClick={() => act("reject")} data-testid={`report-reject-${r.review_id}`} className="h-10 px-4 rounded-full border border-slate-300 text-sm font-semibold inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Tolak Laporan</button>
          </div>
        </div>
      ) : <div className="text-xs text-slate-500">Diputus {r.report.resolved_by}: {r.report.status === "hidden" ? "disembunyikan" : "laporan ditolak"}{r.report.admin_note && ` · ${r.report.admin_note}`}</div>}
    </div>
  );
};

export const ReviewReportBoard = () => {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState(null);
  const load = useCallback(() => api.get("/admin/review-reports", { params: { status } }).then(({ data }) => setItems(data)), [status]);
  useEffect(() => { load(); }, [load]);
  return (
    <section className="space-y-4" data-testid="review-report-board">
      <h3 className="font-heading text-lg font-semibold">Laporan Ulasan dari Vendor</h3>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} data-testid={`report-filter-${k}`}
            className={`h-9 px-4 rounded-full text-sm border transition-colors ${status === k ? "bg-[#1E242B] text-white border-[#1E242B]" : "bg-white border-slate-200 hover:border-slate-400"}`}>{l}</button>
        ))}
      </div>
      {!items ? <div className="h-24 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0
        ? <div className="py-10 text-center border border-dashed rounded-xl text-slate-500" data-testid="review-report-empty">Tidak ada laporan.</div>
        : <div className="grid lg:grid-cols-2 gap-4">{items.map((r) => <ReportCard key={r.review_id} r={r} onDone={load} />)}</div>}
    </section>
  );
};
