import { imgSrc } from "@/lib/api";

export const milestonePct = (p) => (p.milestones || []).filter((m) => m.status === "released").reduce((s, m) => s + m.pct, 0);

const Bar = ({ label, value, color, testid }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-mono font-semibold" data-testid={testid}>{value}%</span></div>
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-[width] duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

export const ProgressBars = ({ p, compact = false }) => (
  <div className={compact ? "space-y-2" : "space-y-3"} data-testid={`progress-bars-${p.project_id}`}>
    <Bar label="Progres pekerjaan (laporan pelaksana)" value={p.progress_percent || 0} color="bg-amber-600" testid={`progress-reported-${p.project_id}`} />
    <Bar label="Milestone escrow dirilis" value={milestonePct(p)} color="bg-green-600" testid={`progress-milestone-${p.project_id}`} />
  </div>
);

export const ProjectProgress = ({ p }) => {
  const updates = [...(p.progress_updates || [])].reverse();
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5" data-testid="project-progress">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">Progres Proyek</h2>
        <span className="text-[10px] font-mono uppercase tracking-widest text-green-700 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live</span>
      </div>
      <ProgressBars p={p} />
      {updates.length > 0 ? (
        <ol className="space-y-4 border-l-2 border-slate-200 pl-5" data-testid="progress-updates">
          {updates.map((u) => (
            <li key={u.id} className="relative space-y-1.5" data-testid={`progress-update-${u.id}`}>
              <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-amber-600 ring-4 ring-white" />
              <div className="text-sm"><b className="font-mono">{u.percent}%</b> · {u.note}</div>
              <div className="text-[11px] text-slate-500 font-mono">{u.by} · {new Date(u.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
              {u.photos?.length > 0 && (
                <div className="flex flex-wrap gap-2">{u.photos.map((src, i) => <a key={i} href={imgSrc(src)} target="_blank" rel="noreferrer"><img src={imgSrc(src)} alt="" className="w-20 h-16 rounded object-cover border" /></a>)}</div>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-slate-500">Belum ada laporan progres dari pelaksana.</p>}
    </section>
  );
};
