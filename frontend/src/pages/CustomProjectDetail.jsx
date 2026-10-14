import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2, MapPin, Phone, Ruler } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, imgSrc } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { FINISHING, PROJECT_STATUS, UNIT_LABEL, WORK_TYPES } from "@/lib/custom";
import { MilestoneTracker } from "@/components/custom/MilestoneTracker";
import { MilestoneAction } from "@/components/custom/MilestoneAction";
import { BidForm } from "@/components/custom/BidForm";
import { BidCard } from "@/components/custom/BidCard";
import { CompareBar, CompareDialog } from "@/components/custom/BidCompare";
import { ProjectProgress } from "@/components/custom/ProjectProgress";
import { ProgressUpdateForm } from "@/components/custom/ProgressUpdateForm";
import { ReviewForm } from "@/components/ReviewForm";
import { ClientInvitations, VendorInvitation } from "@/components/custom/Invitations";

const Info = ({ icon: Icon, children }) => <div className="flex items-center gap-2 text-sm text-slate-700"><Icon className="w-4 h-4 text-slate-400" />{children}</div>;

export default function CustomProjectDetail() {
  const { projectId } = useParams();
  const [p, setP] = useState(null);
  const [cmp, setCmp] = useState([]);
  const [showCmp, setShowCmp] = useState(false);
  const load = useCallback(() => api.get(`/custom/projects/${projectId}`).then(({ data }) => setP(data)).catch(() => setP(false)), [projectId]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  if (p === false) return <div className="py-32 text-center" data-testid="project-not-found">Proyek tidak ditemukan atau sudah ditangani vendor lain.</div>;
  if (!p) return <div className="py-32 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const st = PROJECT_STATUS[p.status];
  const accept = async (bid) => {
    const dp = Math.round(bid.amount * 0.3);
    if (!window.confirm(`Pilih ${bid.vendor_name} (${rupiah(bid.amount)}) sebagai pemenang dan bayar DP Milestone 1 sebesar ${rupiah(dp)} ke Escrow MatShop?`)) return;
    try {
      await api.post(`/custom/projects/${p.project_id}/bids/${bid.bid_id}/accept`);
      await api.post(`/custom/projects/${p.project_id}/milestones/m1/pay`);
      toast.success("Pemenang dipilih & DP 30% ditahan di Escrow MatShop");
      setCmp([]);
    } catch (e) { toast.error(errMsg(e)); }
    load();
  };
  const cancel = async () => {
    try { await api.post(`/custom/projects/${p.project_id}/cancel`); toast.success("Request dibatalkan"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const merge = (data) => setP({ ...p, ...data });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8" data-testid="project-detail-page">
      <Link to="/dashboard" className="text-sm text-slate-600 inline-flex items-center gap-1 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">{p.project_id} · {WORK_TYPES[p.work_type].label}</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{p.title}</h1>
          <span className={`inline-block mt-3 text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`} data-testid="project-status"><span className="font-mono">{st.code}</span> · {st.label}</span>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono uppercase text-slate-500">{p.contract_amount ? "Nilai Kontrak" : "Est. Budget Klien"}</div>
          <div className="font-heading text-2xl font-bold" data-testid="project-value">{rupiah(p.contract_amount || p.budget || p.estimate_max)}</div>
          {!p.contract_amount && p.estimate_min && <div className="text-xs text-slate-500">Estimasi sistem {rupiah(p.estimate_min)} – {rupiah(p.estimate_max)}</div>}
          {p.vendor_name && <div className="text-sm text-slate-600">Vendor: {p.vendor_name}</div>}
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <p className="text-slate-700 leading-relaxed" data-testid="project-description">{p.description}</p>
          {p.photos?.length > 0 && (
            <div className="flex flex-wrap gap-3" data-testid="project-photos">
              {p.photos.map((src, i) => <a key={i} href={imgSrc(src)} target="_blank" rel="noreferrer"><img src={imgSrc(src)} alt="" className="w-28 h-24 rounded-lg object-cover border" /></a>)}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          {p.size && <Info icon={Ruler}>{p.size} {UNIT_LABEL[p.unit]}{p.finishing ? ` · Finishing ${FINISHING[p.finishing].label}` : ""}</Info>}
          <Info icon={MapPin}>{p.address}, {p.city}</Info>
          {p.phone && <Info icon={Phone}>{p.phone}</Info>}
          {p.survey_date && <Info icon={CalendarDays}>Survey diinginkan: {p.survey_date}</Info>}
          <div className="text-xs text-slate-500">Klien: {p.client_name}</div>
          {p.viewer === "client" && ["open", "pending_review"].includes(p.status) && <button onClick={cancel} data-testid="project-cancel-button" className="text-xs text-red-600 hover:underline">Batalkan request</button>}
        </div>
      </div>

      {p.status === "pending_review" && (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 text-sm" data-testid="project-pending-banner">
          <b className="font-mono">PENDING_REVIEW_INTERNAL</b> · Tim MatShop sedang meninjau request Anda. Setelah disetujui, proyek dibuka ke kontraktor terverifikasi (OPEN_FOR_BID) dan Anda akan menerima notifikasi setiap ada penawaran.
        </div>
      )}
      {p.status === "rejected" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" data-testid="project-rejected-banner">Request ditolak tim MatShop. {p.review?.note}</div>
      )}
      {p.status === "internal_takeover" && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5 space-y-1 text-sm text-red-900" data-testid="takeover-banner">
          <div className="font-heading font-semibold text-base">INTERNAL_TAKEOVER · Garansi Penyelesaian MatShop.id</div>
          <p>Proyek diambil alih <b>Master Workshop MatShop</b> dari {p.original_vendor_name}. Sisa dana escrow {rupiah(p.takeover?.escrow_transferred)} dialihkan ke Master Workshop; milestone tersisa tetap dibayar via escrow dan MatShop menjamin penyelesaian proyek.</p>
        </div>
      )}
      {p.vendor_id && <ProjectProgress p={p} />}
      {p.viewer === "vendor" && ["awarded", "in_progress", "internal_takeover"].includes(p.status) && <ProgressUpdateForm p={p} onSaved={merge} />}
      {p.milestones?.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">Escrow Bertahap (Milestone Payment)</h2>
          <MilestoneTracker milestones={p.milestones} renderAction={(m, i) => <MilestoneAction p={p} m={m} i={i} viewer={p.viewer} onChange={merge} />} />
        </section>
      )}

      {p.viewer === "client" && p.status === "completed" && <ReviewForm source="project" refId={p.project_id} />}

      {p.viewer === "client" && p.invitations?.length > 0 && <ClientInvitations items={p.invitations} />}
      {p.viewer === "bidder" && p.status === "open" && p.invitations?.[0] && <VendorInvitation p={p} inv={p.invitations[0]} onChange={load} />}
      {p.viewer === "bidder" && p.status === "open" && p.invitations?.[0]?.status !== "declined" && <BidForm project={p} existing={p.bids[0]} onDone={load} />}

      {p.bids?.length > 0 && (
        <section className="space-y-4" data-testid="project-bids">
          <h2 className="font-heading text-xl font-semibold">{p.viewer === "client" ? `Penawaran Masuk (${p.bids.length})` : "Penawaran Anda"}</h2>
          {p.bids.map((b) => {
            const canCmp = p.viewer === "client" && p.status === "open" && p.bids.length > 1;
            const on = cmp.includes(b.bid_id);
            return <BidCard key={b.bid_id} bid={b} canAccept={p.viewer === "client" && p.status === "open"} onAccept={accept}
              compare={canCmp && { checked: on, disabled: !on && cmp.length >= 3, onToggle: () => setCmp(on ? cmp.filter((x) => x !== b.bid_id) : [...cmp, b.bid_id]) }} />;
          })}
          {cmp.length > 0 && p.status === "open" && <CompareBar n={cmp.length} onOpen={() => setShowCmp(true)} onClear={() => setCmp([])} />}
          {showCmp && <CompareDialog bids={p.bids.filter((b) => cmp.includes(b.bid_id))} onClose={() => setShowCmp(false)} onAccept={(b) => { setShowCmp(false); accept(b); }} />}
        </section>
      )}
      {p.viewer === "client" && p.status === "open" && !p.bids.length && (
        <div className="py-10 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid="project-no-bids">Belum ada penawaran. Vendor workshop akan segera mengirim RAB.</div>
      )}

      <section className="space-y-2 text-sm" data-testid="project-timeline">
        <h2 className="font-heading text-xl font-semibold mb-2">Riwayat</h2>
        {p.timeline.map((t, k) => (
          <div key={k} className="flex gap-3"><span className="font-mono text-xs text-slate-400 w-28 shrink-0">{new Date(t.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span><span>{t.note}</span></div>
        ))}
      </section>
    </div>
  );
}
