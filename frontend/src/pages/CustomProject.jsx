import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, MapPinned, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useCustomConfig } from "@/lib/custom";
import { MilestoneTracker } from "@/components/custom/MilestoneTracker";
import { DimsFields, dimsPayload, dimsReady, WorkIcon } from "@/components/custom/Dims";

const Choice = ({ active, onClick, children, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid}
    className={`p-4 rounded-xl border-2 text-left transition-colors ${active ? "border-amber-600 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-400"}`}>
    {children}
  </button>
);

const DEFAULT_DIMS = { cabinet: { p: 300, l: 60, t: 85, area: "" }, surface: { p: 300, l: "", t: 250, area: "" }, area: { p: "", l: "", t: "", area: 36 } };

const Result = ({ est, wt, query }) => (
  <aside className="lg:col-span-5 bg-[#1E242B] text-white rounded-2xl p-8 space-y-6 h-fit lg:sticky lg:top-24 blueprint-grid-dark" data-testid="calc-result">
    <div className="text-xs font-mono uppercase tracking-widest text-amber-500">Estimasi Range Biaya</div>
    {est?.warning && <div className="rounded-lg bg-red-500/15 border border-red-400/40 text-red-200 text-sm p-3 flex gap-2" data-testid="calc-warning"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{est.warning}</div>}
    {est && est.min != null ? (
      <>
        <div className="font-heading text-3xl sm:text-4xl font-bold leading-tight" data-testid="calc-range">{rupiah(est.min)} – {rupiah(est.max)}</div>
        <div className="text-sm text-slate-300 space-y-1" data-testid="calc-rate">
          <div>{wt.label} · {est.finishing_label}</div>
          <div className="font-mono text-xs">{est.size_label} → <b className="text-amber-400" data-testid="calc-qty">{est.qty.toLocaleString("id-ID")} {est.unit_label}</b></div>
          <div className="font-mono text-xs">× {rupiah(est.rate_min)}–{rupiah(est.rate_max)}/{est.unit_label}</div>
        </div>
        {est.breakdown.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono" data-testid="calc-breakdown">
            {est.breakdown.map(([k, v]) => <div key={k} className="rounded bg-white/5 px-2 py-1.5"><div className="text-slate-400">{k}</div><div>{v}</div></div>)}
          </div>
        )}
      </>
    ) : !est?.warning && <div className="text-slate-400">Masukkan ukuran yang valid.</div>}
    <Link to={`/custom-project/ajukan?${query}`} data-testid="calc-request-survey-button"
      className="h-12 w-full rounded-full bg-amber-600 font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors">
      <MapPinned className="w-4 h-4" /> Minta Survey Lokasi
    </Link>
    <p className="text-xs text-slate-400 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 text-amber-500" /> Estimasi belum termasuk biaya bongkar, listrik, & aksesoris premium (engsel soft-close, lampu LED).</p>
  </aside>
);

export default function CustomProject() {
  const cfg = useCustomConfig();
  const [type, setType] = useState(null);
  const [dims, setDims] = useState(DEFAULT_DIMS.cabinet);
  const [finishing, setFinishing] = useState(null);
  const [est, setEst] = useState(null);
  const wt = cfg?.work_types.find((w) => w.key === type);
  const fins = cfg ? cfg.finishings.filter((f) => wt?.finishings.includes(f.key)) : [];

  const pick = (w) => { setType(w.key); setDims(DEFAULT_DIMS[w.mode]); setFinishing(w.finishings[0] || null); };
  useEffect(() => { if (cfg && !type && cfg.work_types[0]) pick(cfg.work_types[0]); }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!wt || !finishing || !dimsReady(wt.mode, dims)) return setEst(null);
    const t = setTimeout(() => api.post("/custom/estimate", { work_type: type, finishing, dims: dimsPayload(wt.mode, dims) }).then(({ data }) => setEst(data)).catch(() => setEst(null)), 250);
    return () => clearTimeout(t);
  }, [type, dims, finishing]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = new URLSearchParams(Object.fromEntries(Object.entries({ type, finishing, ...(wt ? dimsPayload(wt.mode, dims) : {}), budget: est?.min != null ? Math.round((est.min + est.max) / 2) : "" }).filter(([, v]) => v))).toString();

  return (
    <div data-testid="custom-project-page">
      <section className="blueprint-grid border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-4">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600">Custom Furniture & Fit-Out Project</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl">Kalkulator Estimasi Kitchen Set, Wardrobe & Interior</h1>
          <p className="text-slate-600 max-w-2xl">Hitung kisaran biaya dalam hitungan detik. Harga final ditentukan setelah survey lokasi & penawaran RAB dari vendor workshop.</p>
        </div>
      </section>
      {!cfg || !wt ? <div className="max-w-7xl mx-auto px-4 py-12"><div className="h-64 rounded-xl bg-[#F1EFE9] animate-pulse" /></div> : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3">
              <div className="text-sm font-semibold">1. Jenis Pekerjaan</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cfg.work_types.map((w) => (
                  <Choice key={w.key} active={type === w.key} onClick={() => pick(w)} testid={`calc-type-${w.key}`}>
                    <span className={`block mb-2 ${type === w.key ? "text-amber-600" : "text-slate-600"}`}><WorkIcon wt={w} /></span>
                    <div className="font-heading font-semibold text-sm">{w.label}</div>
                    <div className="text-xs text-slate-500 mt-1">per {w.unit_label}</div>
                  </Choice>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-semibold">2. Ukuran — {wt.hint || cfg.modes[wt.mode]}</div>
              <DimsFields mode={wt.mode} value={dims} onChange={setDims} prefix="calc" />
              {wt.mode !== "area" && <p className="text-xs text-slate-500">Input dalam cm, dihitung otomatis dalam meter.</p>}
            </div>
            <div className="space-y-3">
              <div className="text-sm font-semibold">3. Pilihan Finishing</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {fins.map((f) => (
                  <Choice key={f.key} active={finishing === f.key} onClick={() => setFinishing(f.key)} testid={`calc-finishing-${f.key}`}>
                    <div className="font-heading font-semibold">{f.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{f.desc}</div>
                  </Choice>
                ))}
              </div>
            </div>
          </div>
          <Result est={est} wt={wt} query={query} />
        </div>
      )}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Escrow Bertahap (Milestone Payment)</h2>
        <MilestoneTracker total={est?.min != null ? (est.min + est.max) / 2 : null} />
      </section>
    </div>
  );
}
