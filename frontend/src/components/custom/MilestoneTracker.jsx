import { Check, Lock } from "lucide-react";
import { rupiah } from "@/lib/format";
import { MILESTONES, MS_STATUS } from "@/lib/custom";

export const MilestoneTracker = ({ milestones, total, renderAction }) => {
  const list = milestones?.length ? milestones : MILESTONES.map((m) => ({ ...m, amount: total ? (total * m.pct) / 100 : null, status: "pending" }));
  return (
    <ol className="grid md:grid-cols-3 gap-4" data-testid="milestone-tracker">
      {list.map((m, i) => {
        const st = MS_STATUS[m.status];
        const done = m.status === "released";
        return (
          <li key={m.key} data-testid={`milestone-${m.key}`}
            className={`rounded-xl border p-5 space-y-3 bg-white ${done ? "border-green-300" : m.status !== "pending" ? "border-amber-400" : "border-slate-200"}`}>
            <div className="flex items-center justify-between">
              <span className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold ${done ? "bg-green-600 text-white" : "bg-[#F1EFE9] text-slate-700"}`}>
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              <span className="font-mono text-lg font-bold text-amber-600">{m.pct}%</span>
            </div>
            <div className="font-heading font-semibold leading-snug">{m.label}</div>
            {m.amount != null && <div className="font-mono text-sm" data-testid={`milestone-amount-${m.key}`}>{rupiah(m.amount)}</div>}
            {milestones?.length > 0 && (
              <div className={`text-xs font-medium flex items-center gap-1 ${st.cls}`} data-testid={`milestone-status-${m.key}`}>
                {m.status === "held" && <Lock className="w-3 h-3" />}{st.label}
              </div>
            )}
            {m.vendor_note && <div className="text-xs bg-blue-50 text-blue-800 rounded p-2">Laporan vendor: {m.vendor_note}</div>}
            {renderAction?.(m, i)}
          </li>
        );
      })}
    </ol>
  );
};
