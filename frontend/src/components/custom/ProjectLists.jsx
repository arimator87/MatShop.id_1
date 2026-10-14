import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RequestForm } from "@/components/custom/RequestForm";
import { VerificationGate } from "@/components/verify/VerificationGate";
import { ProgressBars } from "@/components/custom/ProjectProgress";
import { ProgressUpdateForm } from "@/components/custom/ProgressUpdateForm";
import { ArrowUpRight, MapPin, Plus } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { PROJECT_STATUS, sizeText } from "@/lib/custom";

export const ProjectCard = ({ p, badge }) => {
  const st = PROJECT_STATUS[p.status];
  const done = p.milestones?.filter((m) => m.status === "released").length || 0;
  return (
    <Link to={`/custom-project/${p.project_id}`} data-testid={`project-card-${p.project_id}`}
      className="group bg-white rounded-xl border border-slate-200 p-5 flex gap-4 hover:border-slate-400 transition-colors">
      <div className="w-24 h-24 rounded-lg bg-[#F1EFE9] overflow-hidden shrink-0">
        {p.photos?.[0] && <img src={imgSrc(p.photos[0])} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{p.project_id} · {p.work_type_label}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.cls}`} data-testid={`project-card-status-${p.project_id}`}><span className="font-mono">{st.code}</span> · {st.label}</span>
          {badge}
        </div>
        <div className="font-heading font-semibold line-clamp-1 group-hover:text-amber-700">{p.title}</div>
        <div className="text-xs text-slate-600 flex items-center gap-1"><MapPin className="w-3 h-3" />{p.city}{p.size_label ? ` · ${sizeText(p)}` : ""}{p.finishing_label ? ` · ${p.finishing_label}` : ""}</div>
        <div className="text-sm font-mono">{p.contract_amount ? `Kontrak ${rupiah(p.contract_amount)} · Milestone ${done}/3` : `Budget ${rupiah(p.budget ?? p.estimate_max)} · ${p.bid_count} penawaran`}</div>
        {p.contract_amount && <div className="pt-2 max-w-md"><ProgressBars p={p} compact /></div>}
      </div>
      <ArrowUpRight className="w-5 h-5 text-slate-400 shrink-0" />
    </Link>
  );
};

const List = ({ items, empty, testid, badge }) => {
  if (!items) return <div className="h-32 rounded-xl bg-[#F1EFE9] animate-pulse" />;
  if (!items.length) return <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid={`${testid}-empty`}>{empty}</div>;
  return <div className="space-y-3" data-testid={testid}>{items.map((p) => <ProjectCard key={p.project_id} p={p} badge={badge?.(p)} />)}</div>;
};

const WonProject = ({ p, onSaved }) => {
  const [open, setOpen] = useState(false);
  const active = ["awarded", "in_progress"].includes(p.status);
  return (
    <div className="space-y-2">
      <ProjectCard p={p} />
      {active && (
        <button onClick={() => setOpen(!open)} data-testid={`toggle-progress-form-${p.project_id}`} className="text-sm font-semibold text-amber-700 hover:underline">
          {open ? "Tutup form" : "+ Update progres (foto & persentase)"}
        </button>
      )}
      {active && open && <ProgressUpdateForm p={p} onSaved={(d) => { onSaved(d); setOpen(false); }} />}
    </div>
  );
};

export const ProjectOpportunities = () => {
  const [open, setOpen] = useState(null);
  const [mine, setMine] = useState(null);
  useEffect(() => {
    api.get("/custom/opportunities").then(({ data }) => setOpen(data));
    api.get("/custom/vendor-projects").then(({ data }) => setMine(data));
  }, []);
  return (
    <div className="space-y-10" data-testid="project-opportunities">
      <VerificationGate testid="board-verification-warning" />
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-semibold">Request Terbuka dari Klien</h3>
        <List items={open} testid="opportunities-list" empty="Belum ada request proyek terbuka."
          badge={(p) => <>
            {p.invited && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1E242B] text-amber-400 font-semibold" data-testid={`invited-badge-${p.project_id}`}>Diundang{p.invitation_status !== "pending" ? ` · ${p.invitation_status === "accepted" ? "Diterima" : "Ditolak"}` : ""}</span>}
            {p.has_my_bid && <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">Sudah ditawar</span>}
          </>} />
      </div>
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-semibold">Proyek yang Saya Menangkan</h3>
        {mine && mine.length > 0 ? (
          <div className="space-y-4" data-testid="won-projects-list">
            {mine.map((p) => <WonProject key={p.project_id} p={p} onSaved={(d) => setMine(mine.map((x) => (x.project_id === d.project_id ? d : x)))} />)}
          </div>
        ) : <List items={mine} testid="won-projects-list" empty="Belum ada proyek yang dimenangkan." />}
      </div>
    </div>
  );
};

export const MyCustomProjects = () => {
  const [items, setItems] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const load = () => api.get("/custom/projects/mine").then(({ data }) => setItems(data));
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4" data-testid="my-custom-projects">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} data-testid="my-projects-new-button"
          className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> {showForm ? "Tutup Form" : "Ajukan Proyek Custom Furniture / Fit-Out"}</button>
      </div>
      {showForm && <RequestForm onCreated={() => { setShowForm(false); load(); }} />}
      <List items={items} testid="my-projects-list" empty="Belum ada proyek custom. Coba kalkulator estimasi di menu Custom Furniture." />
    </div>
  );
};
