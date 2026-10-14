import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { FINISHING, UNIT_LABEL, WORK_TYPES } from "@/lib/custom";
import { ImagesField } from "@/components/ListingForm";

const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const L = ({ label, children }) => <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;

export default function CustomProjectRequest() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [f, setF] = useState({
    work_type: sp.get("type") || "kitchen_set", size: sp.get("size") || 3, finishing: sp.get("finishing") || "hpl",
    title: "", description: "", address: "", city: "", phone: "", survey_date: "", photos: [],
  });
  const [est, setEst] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (f.size > 0) api.post("/custom/estimate", { work_type: f.work_type, size: Number(f.size), finishing: f.finishing }).then(({ data }) => setEst(data));
  }, [f.work_type, f.size, f.finishing]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/custom/projects", { ...f, size: Number(f.size), survey_date: f.survey_date || null });
      toast.success("Proyek diajukan! Vendor workshop akan mengirim penawaran RAB");
      navigate(`/custom-project/${data.project_id}`);
    } catch (err) { toast.error(errMsg(err)); setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8" data-testid="custom-request-page">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">Custom Furniture & Fit-Out</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Ajukan Proyek Custom</h1>
        <p className="text-slate-600 mt-2">Ceritakan kebutuhan Anda. Vendor workshop & kontraktor akan mengirim penawaran RAB.</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-3 gap-4">
        <L label="Jenis pekerjaan">
          <select className={inputCls} value={f.work_type} onChange={set("work_type")} data-testid="request-type-select">
            {Object.entries(WORK_TYPES).map(([k, w]) => <option key={k} value={k}>{w.label}</option>)}
          </select>
        </L>
        <L label={`Ukuran (${UNIT_LABEL[WORK_TYPES[f.work_type].unit]})`}>
          <input type="number" min={0.5} step={0.5} required className={inputCls} value={f.size} onChange={set("size")} data-testid="request-size-input" />
        </L>
        <L label="Finishing">
          <select className={inputCls} value={f.finishing} onChange={set("finishing")} data-testid="request-finishing-select">
            {Object.entries(FINISHING).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </L>
        {est && <div className="sm:col-span-3 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="request-estimate">Estimasi: <b className="font-mono">{rupiah(est.min)} – {rupiah(est.max)}</b></div>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <L label="Judul proyek"><input required className={inputCls} value={f.title} onChange={set("title")} placeholder="Kitchen set L-shape apartemen 2BR" data-testid="request-title-input" /></L>
        <L label="Deskripsi kebutuhan">
          <textarea required minLength={10} className={`${inputCls} h-28 py-3`} value={f.description} onChange={set("description")}
            placeholder="Gaya desain, warna, kebutuhan kompor tanam/sink, budget, target selesai..." data-testid="request-description-input" />
        </L>
        <L label="Foto ruangan / sketsa (maks. 8)"><ImagesField images={f.photos} onChange={(photos) => setF({ ...f, photos: photos.slice(0, 8) })} testid="request-photo" /></L>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><L label="Alamat lokasi proyek"><input required className={inputCls} value={f.address} onChange={set("address")} data-testid="request-address-input" /></L></div>
        <L label="Kota"><input required className={inputCls} value={f.city} onChange={set("city")} data-testid="request-city-input" /></L>
        <L label="No. HP / WhatsApp"><input required className={inputCls} value={f.phone} onChange={set("phone")} data-testid="request-phone-input" /></L>
        <L label="Tanggal survey yang diinginkan"><input type="date" className={inputCls} value={f.survey_date} onChange={set("survey_date")} data-testid="request-survey-date-input" /></L>
      </div>
      <button type="submit" disabled={busy} data-testid="request-submit-button"
        className="h-12 w-full rounded-full bg-amber-600 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-60">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Kirim Request & Minta Survey Lokasi
      </button>
    </form>
  );
}
