import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPin, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, imgSrc } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { PROJECT_STATUS } from "@/lib/custom";

const ReviewCard = ({ p, onDone }) => {
  const [note, setNote] = useState("");
  const act = async (kind) => {
    try {
      await api.post(`/custom/admin/projects/${p.project_id}/${kind}`, { note });
      toast.success(kind === "approve" ? "Proyek dibuka untuk penawaran (OPEN_FOR_BID)" : "Request ditolak");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const st = PROJECT_STATUS[p.status];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4" data-testid={`review-card-${p.project_id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{p.project_id} · {p.work_type_label} · {p.client_name}</div>
          <Link to={`/custom-project/${p.project_id}`} className="font-heading font-semibold text-lg hover:text-amber-700">{p.title}</Link>
          <div className="text-xs text-slate-600 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{p.address}, {p.city}</div>
        </div>
        <div className="text-right">
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.cls}`}><span className="font-mono">{st.code}</span></span>
          <div className="font-mono text-sm mt-1 flex items-center gap-1 justify-end"><Wallet className="w-3.5 h-3.5" /> Budget {rupiah(p.budget)}</div>
        </div>
      </div>
      <p className="text-sm text-slate-700">{p.description}</p>
      {p.photos?.length > 0 && (
        <div className="flex flex-wrap gap-2">{p.photos.map((src, i) => <img key={i} src={imgSrc(src)} alt="" className="w-20 h-16 rounded object-cover border" />)}</div>
      )}
      {p.review?.note && <div className="text-xs text-slate-500">Catatan review: {p.review.note}</div>}
      {p.status === "pending_review" && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed">
          <input data-testid={`review-note-${p.project_id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan review (wajib jika ditolak)"
            className="flex-1 min-w-[200px] h-10 px-3 rounded-full border border-slate-300 text-sm outline-none focus:border-amber-600" />
          <button data-testid={`review-approve-${p.project_id}`} onClick={() => act("approve")}
            className="h-10 px-4 rounded-full bg-green-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Setujui · Buka Bid</button>
          <button data-testid={`review-reject-${p.project_id}`} onClick={() => act("reject")}
            className="h-10 px-4 rounded-full border border-red-300 text-red-700 text-sm font-semibold inline-flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Tolak</button>
        </div>
      )}
    </div>
  );
};

export const ProjectReviewBoard = () => {
  const [status, setStatus] = useState("pending_review");
  const [items, setItems] = useState(null);
  const load = useCallback(() => api.get("/custom/admin/projects", { params: { status } }).then(({ data }) => setItems(data)), [status]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-5" data-testid="project-review-board">
      <div className="flex flex-wrap gap-2">
        {[["pending_review", "Perlu Review"], ["open", "OPEN_FOR_BID"], ["rejected", "Ditolak"], ["all", "Semua"]].map(([k, l]) => (
          <button key={k} data-testid={`review-filter-${k}`} onClick={() => setStatus(k)}
            className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${status === k ? "bg-[#1E242B] text-white border-[#1E242B]" : "bg-white border-slate-200 hover:border-slate-400"}`}>{l}</button>
        ))}
      </div>
      {!items ? <div className="h-32 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid="review-empty">Tidak ada proyek.</div>
      ) : items.map((p) => <ReviewCard key={p.project_id} p={p} onDone={load} />)}
    </div>
  );
};
