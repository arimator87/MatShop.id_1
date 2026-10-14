import { useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { TRACK_STAGES } from "@/lib/format";

export const TrackingUpdate = ({ o, onDone }) => {
  const last = (o.tracking || []).at(-1)?.stage || "loading";
  const lastIdx = TRACK_STAGES.findIndex((s) => s.key === last);
  const options = TRACK_STAGES.filter((s, i) => i > lastIdx || s.key === "in_transit");
  const [stage, setStage] = useState(options[0]?.key);
  const [location, setLocation] = useState("");
  if (last === "arrived")
    return <span className="text-xs text-green-700 font-semibold" data-testid={`tracking-arrived-${o.order_id}`}>Armada tiba di lokasi · menunggu konfirmasi buyer</span>;

  const submit = async () => {
    try {
      await api.post(`/orders/${o.order_id}/tracking`, { stage, location });
      toast.success("Posisi armada diperbarui");
      setLocation("");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <select data-testid={`tracking-stage-select-${o.order_id}`} value={stage} onChange={(e) => setStage(e.target.value)}
        className="h-10 px-3 rounded-full border border-slate-300 text-sm bg-white">
        {options.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <input data-testid={`tracking-location-${o.order_id}`} value={location} onChange={(e) => setLocation(e.target.value)}
        placeholder={stage === "arrived" ? "Kosongkan = alamat proyek" : "Posisi saat ini, mis. Tol Cikampek KM 47"}
        className="h-10 px-3 rounded-full border border-slate-300 text-sm w-60 outline-none focus:border-amber-600" />
      <button data-testid={`tracking-submit-${o.order_id}`} onClick={submit}
        className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Update Posisi</button>
    </div>
  );
};
