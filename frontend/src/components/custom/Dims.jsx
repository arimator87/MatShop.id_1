import { imgSrc } from "@/lib/api";
import { ICONS } from "@/lib/custom";

export const WorkIcon = ({ wt, cls = "w-6 h-6" }) => {
  if (wt.icon_image) return <img src={imgSrc(wt.icon_image)} alt="" className={`${cls} object-cover rounded`} />;
  const I = ICONS[wt.icon] || ICONS.Hammer;
  return <I className={cls} />;
};

const DIM_FIELDS = { cabinet: [["p", "Panjang (P)"], ["l", "Lebar / Kedalaman (L)"], ["t", "Tinggi (T)"]], surface: [["p", "Panjang (P)"], ["t", "Tinggi (T)"]], area: [["area", "Luas lantai"]] };

export const emptyDims = { p: "", l: "", t: "", area: "" };
export const dimsPayload = (mode, d) => Object.fromEntries(DIM_FIELDS[mode].map(([k]) => [k, d[k] ? Number(d[k]) : null]));
export const dimsReady = (mode, d) => DIM_FIELDS[mode].every(([k]) => Number(d[k]) > 0);

export const DimsFields = ({ mode, value, onChange, prefix, inputCls }) => (
  <div className={`grid gap-3 ${mode === "cabinet" ? "grid-cols-3" : mode === "surface" ? "grid-cols-2" : "grid-cols-1 max-w-xs"}`}>
    {DIM_FIELDS[mode].map(([k, label]) => (
      <label key={k} className="block space-y-1 min-w-0">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <div className="relative">
          <input type="number" min={1} step="any" value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} data-testid={`${prefix}-dim-${k}`}
            className={inputCls || "w-full h-12 pl-3 pr-10 rounded-lg border border-slate-300 bg-white font-mono text-lg outline-none focus:border-amber-600"} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{k === "area" ? "m²" : "cm"}</span>
        </div>
      </label>
    ))}
  </div>
);
