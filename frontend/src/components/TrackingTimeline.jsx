import { Check, MapPin, Truck, Warehouse } from "lucide-react";
import { TRACK_STAGES } from "@/lib/format";

export const TrackingTimeline = ({ o }) => {
  if (o.shipping_method === "pickup")
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex gap-3 text-sm" data-testid="tracking-pickup">
        <Warehouse className="w-5 h-5 text-amber-600 shrink-0" />
        <div><div className="font-semibold">Ambil Mandiri di Gudang Vendor</div><div className="text-slate-600">{o.warehouse_location || "Lokasi gudang dikonfirmasi vendor"}</div></div>
      </div>
    );
  if (o.shipping_method !== "vendor_cargo") return null;
  const log = o.tracking || [];
  const reached = Object.fromEntries(log.map((t) => [t.stage, t]));
  const lastIdx = Math.max(-1, ...log.map((t) => TRACK_STAGES.findIndex((s) => s.key === t.stage)));
  const transitUpdates = log.filter((t) => t.stage === "in_transit");

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5" data-testid="tracking-timeline">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading font-semibold flex items-center gap-2"><Truck className="w-5 h-5 text-amber-600" /> Lacak Pengiriman Armada Vendor</h3>
        <span className="text-xs font-mono text-slate-500" data-testid="tracking-current">{lastIdx >= 0 ? TRACK_STAGES[lastIdx].label : "Menunggu pengiriman"}</span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-amber-600 transition-[width] duration-700" style={{ width: `${((lastIdx + 1) / TRACK_STAGES.length) * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-600 gap-4">
        <span className="flex items-center gap-1"><Warehouse className="w-3.5 h-3.5" />{o.warehouse_location || "Gudang vendor"}</span>
        <span className="flex items-center gap-1 text-right"><MapPin className="w-3.5 h-3.5" />{o.shipping?.address}</span>
      </div>
      <ol className="space-y-4">
        {TRACK_STAGES.map((s, i) => {
          const t = reached[s.key];
          const done = i <= lastIdx;
          return (
            <li key={s.key} className="flex gap-3" data-testid={`tracking-stage-${s.key}`}>
              <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${done ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-mono">{i + 1}</span>}
              </span>
              <div className="text-sm">
                <div className={done ? "font-semibold" : "text-slate-400"}>{s.label}</div>
                {(s.key === "in_transit" ? transitUpdates : t ? [t] : []).map((u, k) => (
                  <div key={k} className="text-xs text-slate-600">
                    <span className="font-mono text-slate-400">{new Date(u.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
                    {u.location && <> · {u.location}</>}{u.note && <> · {u.note}</>}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
