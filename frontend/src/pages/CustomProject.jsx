import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPinned, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { FINISHING, UNIT_LABEL, WORK_TYPES } from "@/lib/custom";
import { MilestoneTracker } from "@/components/custom/MilestoneTracker";

const Choice = ({ active, onClick, children, testid }) => (
  <button type="button" onClick={onClick} data-testid={testid}
    className={`p-4 rounded-xl border-2 text-left transition-colors ${active ? "border-amber-600 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-400"}`}>
    {children}
  </button>
);

export default function CustomProject() {
  const [type, setType] = useState("kitchen_set");
  const [size, setSize] = useState(3);
  const [finishing, setFinishing] = useState("hpl");
  const [est, setEst] = useState(null);
  const wt = WORK_TYPES[type];

  useEffect(() => {
    if (!(size > 0)) return setEst(null);
    const t = setTimeout(() => api.post("/custom/estimate", { work_type: type, size: Number(size), finishing }).then(({ data }) => setEst(data)), 200);
    return () => clearTimeout(t);
  }, [type, size, finishing]);

  const query = new URLSearchParams({ type, size, finishing, ...(est ? { budget: Math.round((est.min + est.max) / 2) } : {}) }).toString();

  return (
    <div data-testid="custom-project-page">
      <section className="blueprint-grid border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-4">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600">Custom Furniture & Fit-Out Project</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl">Kalkulator Estimasi Kitchen Set, Wardrobe & Interior</h1>
          <p className="text-slate-600 max-w-2xl">Hitung kisaran biaya dalam hitungan detik. Harga final ditentukan setelah survey lokasi & penawaran RAB dari vendor workshop.</p>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <div className="text-sm font-semibold">1. Jenis Pekerjaan</div>
            <div className="grid sm:grid-cols-3 gap-3">
              {Object.entries(WORK_TYPES).map(([k, w]) => (
                <Choice key={k} active={type === k} onClick={() => setType(k)} testid={`calc-type-${k}`}>
                  <w.icon className={`w-6 h-6 mb-2 ${type === k ? "text-amber-600" : "text-slate-600"}`} />
                  <div className="font-heading font-semibold text-sm">{w.label}</div>
                  <div className="text-xs text-slate-500 mt-1">per {UNIT_LABEL[w.unit]}</div>
                </Choice>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold">2. Ukuran / Metrik — {wt.hint}</div>
            <div className="flex items-center gap-3">
              <input data-testid="calc-size-input" type="number" min={0.5} step={0.5} value={size} onChange={(e) => setSize(e.target.value)}
                className="w-40 h-12 px-4 rounded-lg border border-slate-300 bg-white font-mono text-lg outline-none focus:border-amber-600" />
              <span className="text-slate-600">{UNIT_LABEL[wt.unit]}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold">3. Pilihan Finishing</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(FINISHING).map(([k, f]) => (
                <Choice key={k} active={finishing === k} onClick={() => setFinishing(k)} testid={`calc-finishing-${k}`}>
                  <div className="font-heading font-semibold">{f.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{f.desc}</div>
                </Choice>
              ))}
            </div>
          </div>
        </div>
        <aside className="lg:col-span-5 bg-[#1E242B] text-white rounded-2xl p-8 space-y-6 h-fit lg:sticky lg:top-24 blueprint-grid-dark" data-testid="calc-result">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">Estimasi Range Biaya</div>
          {est ? (
            <>
              <div className="font-heading text-3xl sm:text-4xl font-bold leading-tight" data-testid="calc-range">{rupiah(est.min)} – {rupiah(est.max)}</div>
              <div className="text-sm text-slate-300" data-testid="calc-rate">{wt.label} · {FINISHING[finishing].label} · {size} {est.unit_label} × {rupiah(est.rate_min)}–{rupiah(est.rate_max)}/{est.unit_label}</div>
            </>
          ) : <div className="text-slate-400">Masukkan ukuran yang valid.</div>}
          <Link to={`/custom-project/ajukan?${query}`} data-testid="calc-request-survey-button"
            className="h-12 w-full rounded-full bg-amber-600 font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors">
            <MapPinned className="w-4 h-4" /> Minta Survey Lokasi
          </Link>
          <p className="text-xs text-slate-400 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 text-amber-500" /> Estimasi belum termasuk biaya bongkar, listrik, & aksesoris premium (engsel soft-close, lampu LED).</p>
        </aside>
      </div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Escrow Bertahap (Milestone Payment)</h2>
        <MilestoneTracker total={est ? (est.min + est.max) / 2 : null} />
      </section>
    </div>
  );
}
