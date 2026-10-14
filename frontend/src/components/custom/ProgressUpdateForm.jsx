import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { ImagesField } from "@/components/ListingForm";

export const ProgressUpdateForm = ({ p, onSaved }) => {
  const min = p.progress_percent || 0;
  const [percent, setPercent] = useState(min);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/custom/projects/${p.project_id}/progress`, { percent: Number(percent), note, photos });
      toast.success(`Progres ${percent}% dikirim ke klien`);
      setNote(""); setPhotos([]);
      onSaved(data);
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="bg-[#F8F7F4] rounded-xl border border-slate-200 p-5 space-y-4" data-testid={`progress-form-${p.project_id}`}>
      <div className="font-heading font-semibold">Update Progres Pengerjaan</div>
      <div className="flex items-center gap-4">
        <input type="range" min={min} max={100} step={5} value={percent} onChange={(e) => setPercent(e.target.value)}
          className="flex-1 accent-amber-600" data-testid={`progress-range-${p.project_id}`} />
        <input type="number" min={min} max={100} value={percent} onChange={(e) => setPercent(e.target.value)}
          className="w-20 h-10 px-2 rounded-lg border border-slate-300 font-mono text-center" data-testid={`progress-percent-input-${p.project_id}`} />
        <span className="text-sm">%</span>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan pekerjaan, mis. Rangka kabinet bawah selesai dirakit"
        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-amber-600" data-testid={`progress-note-input-${p.project_id}`} />
      <ImagesField images={photos} onChange={(v) => setPhotos(v.slice(0, 8))} testid={`progress-photo-${p.project_id}`} />
      <button onClick={submit} disabled={busy || note.trim().length < 3 || Number(percent) < min}
        className="h-10 px-5 rounded-full bg-amber-600 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50" data-testid={`progress-submit-${p.project_id}`}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Kirim Update Progres
      </button>
    </div>
  );
};
