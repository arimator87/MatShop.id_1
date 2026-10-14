import { Check, Lock, PackageCheck, Truck, Wallet } from "lucide-react";

const STEPS = [
  { label: "Dana Ditahan", icon: Lock },
  { label: "Dikirim / Dikerjakan", icon: Truck },
  { label: "Konfirmasi Buyer", icon: PackageCheck },
  { label: "Dana Dirilis", icon: Wallet },
];
const LEVEL = { awaiting_payment: 0, held: 1, shipped: 2, released: 4 };

export const EscrowTimeline = ({ status }) => {
  const level = LEVEL[status] ?? 0;
  return (
    <div className="grid grid-cols-4 gap-2" data-testid="escrow-timeline">
      {STEPS.map((s, i) => {
        const done = i < level;
        const current = i === level && status !== "released";
        return (
          <div key={s.label} className="flex flex-col gap-2">
            <div className={`h-1.5 rounded-full ${done ? "bg-amber-600" : current ? "bg-amber-200" : "bg-slate-200"}`} />
            <div className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${done ? "bg-amber-600 text-white" : current ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300" : "bg-slate-100 text-slate-400"}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
              </span>
              <span className={`text-[11px] leading-tight ${done || current ? "text-slate-800 font-medium" : "text-slate-400"}`}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
