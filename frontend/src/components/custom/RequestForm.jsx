import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useCustomConfig } from "@/lib/custom";
import { DimsFields, dimsPayload, dimsReady, emptyDims } from "@/components/custom/Dims";
import { ImagesField } from "@/components/ListingForm";

const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const L = ({ label, children, cls = "" }) => <label className={`block space-y-1.5 ${cls}`}><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;

export const RequestForm = ({ initial = {}, onCreated }) => {
  const navigate = useNavigate();
  const [f, setF] = useState({
    work_type: initial.type || "", budget: initial.budget || "", dims: initial.dims || emptyDims, finishing: initial.finishing || "",
    title: "", description: "", address: "", city: "", phone: "", survey_date: "", photos: [],
  });
  const [est, setEst] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const cfg = useCustomConfig();
  const wt = cfg?.work_types.find((w) => w.key === f.work_type);
  useEffect(() => { if (cfg && !wt && cfg.work_types[0]) setF((x) => ({ ...x, work_type: cfg.work_types[0].key, finishing: "" })); }, [cfg, wt]);
  const ready = wt && dimsReady(wt.mode, f.dims);
  useEffect(() => {
    if (!ready) return setEst(null);
    const t = setTimeout(() => api.post("/custom/estimate", { work_type: f.work_type, finishing: f.finishing || null, dims: dimsPayload(wt.mode, f.dims) }).then(({ data }) => setEst(data)).catch(() => setEst(null)), 250);
    return () => clearTimeout(t);
  }, [f.work_type, f.dims, f.finishing, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/custom/projects", {
        ...f, budget: Number(f.budget), dims: ready ? dimsPayload(wt.mode, f.dims) : null, finishing: f.finishing || null, survey_date: f.survey_date || null,
      });
      toast.success("Request terkirim. Tim MatShop akan meninjau sebelum dibuka untuk penawaran");
      onCreated ? onCreated(data) : navigate(`/custom-project/${data.project_id}`);
    } catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="custom-request-form">
      <div className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-2 gap-4">
        <L label="Kategori">
          <select className={inputCls} value={f.work_type} onChange={(e) => setF({ ...f, work_type: e.target.value, finishing: "", dims: emptyDims })} data-testid="request-type-select">
            {cfg?.work_types.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
        </L>
        <L label="Est. Budget (Rp)">
          <input type="number" min={1} required className={inputCls} value={f.budget} onChange={set("budget")} placeholder="15000000" data-testid="request-budget-input" />
        </L>
        <L label="Judul (opsional)" cls="sm:col-span-2"><input className={inputCls} value={f.title} onChange={set("title")} placeholder="Otomatis: Kategori · Kota" data-testid="request-title-input" /></L>
        <L label="Detail kebutuhan" cls="sm:col-span-2">
          <textarea required minLength={10} className={`${inputCls} h-28 py-3`} value={f.description} onChange={set("description")}
            placeholder="Gaya desain, warna, ukuran perkiraan, kompor tanam/sink, target selesai..." data-testid="request-description-input" />
        </L>
        <L label="Foto / sketsa ruangan (maks. 8)" cls="sm:col-span-2"><ImagesField images={f.photos} onChange={(photos) => setF({ ...f, photos: photos.slice(0, 8) })} testid="request-photo" /></L>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-2 gap-4">
        <L label="Lokasi proyek (alamat)" cls="sm:col-span-2"><input required className={inputCls} value={f.address} onChange={set("address")} data-testid="request-address-input" /></L>
        <L label="Kota"><input required className={inputCls} value={f.city} onChange={set("city")} data-testid="request-city-input" /></L>
        <L label="No. HP / WhatsApp"><input required className={inputCls} value={f.phone} onChange={set("phone")} data-testid="request-phone-input" /></L>
        {wt && <div className="sm:col-span-2 space-y-1.5"><span className="text-sm font-medium text-slate-700">Ukuran (opsional) — {wt.hint}</span>
          <DimsFields mode={wt.mode} value={f.dims} onChange={(dims) => setF({ ...f, dims })} prefix="request" inputCls={`${inputCls} pr-10 font-mono`} /></div>}
        <L label="Finishing (opsional)">
          <select className={inputCls} value={f.finishing} onChange={set("finishing")} data-testid="request-finishing-select">
            <option value="">Belum tahu</option>
            {cfg?.finishings.filter((x) => wt?.finishings.includes(x.key)).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </L>
        <L label="Tanggal survey yang diinginkan"><input type="date" className={inputCls} value={f.survey_date} onChange={set("survey_date")} data-testid="request-survey-date-input" /></L>
        {est?.warning && <div className="sm:col-span-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3" data-testid="request-size-warning">{est.warning}</div>}
        {est && <div className="sm:col-span-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="request-estimate">Ukuran terhitung: <b className="font-mono">{est.qty.toLocaleString("id-ID")} {est.unit_label}</b>{est.min != null && <> · Estimasi sistem: <b className="font-mono">{rupiah(est.min)} – {rupiah(est.max)}</b></>}</div>}
      </div>
      <p className="text-xs text-slate-500 flex gap-2"><ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" /> Managed Open-Bid: request ditinjau tim MatShop (PENDING_REVIEW_INTERNAL) sebelum dibuka ke kontraktor terverifikasi (OPEN_FOR_BID).</p>
      <button type="submit" disabled={busy} data-testid="request-submit-button"
        className="h-12 w-full rounded-full bg-amber-600 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-60">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Ajukan Proyek Custom
      </button>
    </form>
  );
};
