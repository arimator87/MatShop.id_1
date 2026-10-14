import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { FINISHING, UNIT_LABEL, WORK_TYPES } from "@/lib/custom";
import { ImagesField } from "@/components/ListingForm";

const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const L = ({ label, children, cls = "" }) => <label className={`block space-y-1.5 ${cls}`}><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;

export const RequestForm = ({ initial = {}, onCreated }) => {
  const navigate = useNavigate();
  const [f, setF] = useState({
    work_type: initial.type || "kitchen_set", budget: initial.budget || "", size: initial.size || "", finishing: initial.finishing || "",
    title: "", description: "", address: "", city: "", phone: "", survey_date: "", photos: [],
  });
  const [est, setEst] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (f.size > 0 && f.finishing) api.post("/custom/estimate", { work_type: f.work_type, size: Number(f.size), finishing: f.finishing }).then(({ data }) => setEst(data));
    else setEst(null);
  }, [f.work_type, f.size, f.finishing]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/custom/projects", {
        ...f, budget: Number(f.budget), size: f.size ? Number(f.size) : null, finishing: f.finishing || null, survey_date: f.survey_date || null,
      });
      toast.success("Request terkirim. Tim MatShop akan meninjau sebelum dibuka untuk penawaran");
      onCreated ? onCreated(data) : navigate(`/custom-project/${data.project_id}`);
    } catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="custom-request-form">
      <div className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-2 gap-4">
        <L label="Kategori">
          <select className={inputCls} value={f.work_type} onChange={set("work_type")} data-testid="request-type-select">
            {Object.entries(WORK_TYPES).map(([k, w]) => <option key={k} value={k}>{w.label}</option>)}
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
        <L label={`Ukuran (opsional, ${UNIT_LABEL[WORK_TYPES[f.work_type].unit]})`}><input type="number" min={0.5} step={0.5} className={inputCls} value={f.size} onChange={set("size")} data-testid="request-size-input" /></L>
        <L label="Finishing (opsional)">
          <select className={inputCls} value={f.finishing} onChange={set("finishing")} data-testid="request-finishing-select">
            <option value="">Belum tahu</option>
            {Object.entries(FINISHING).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </L>
        <L label="Tanggal survey yang diinginkan"><input type="date" className={inputCls} value={f.survey_date} onChange={set("survey_date")} data-testid="request-survey-date-input" /></L>
        {est && <div className="sm:col-span-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="request-estimate">Estimasi sistem: <b className="font-mono">{rupiah(est.min)} – {rupiah(est.max)}</b></div>}
      </div>
      <p className="text-xs text-slate-500 flex gap-2"><ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" /> Managed Open-Bid: request ditinjau tim MatShop (PENDING_REVIEW_INTERNAL) sebelum dibuka ke kontraktor terverifikasi (OPEN_FOR_BID).</p>
      <button type="submit" disabled={busy} data-testid="request-submit-button"
        className="h-12 w-full rounded-full bg-amber-600 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-60">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Ajukan Proyek Custom
      </button>
    </form>
  );
};
