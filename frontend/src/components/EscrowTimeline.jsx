import { Check, Lock, PackageCheck, ShieldAlert, Truck, Wallet } from "lucide-react";

const STEPS = [
  { label: "Dana Ditahan", icon: Lock },
  { label: "Dikirim / Dikerjakan", icon: Truck },
  { label: "Konfirmasi Buyer", icon: PackageCheck },
  { label: "Dana Dirilis", icon: Wallet },
];
const LEVEL = { awaiting_payment: 0, held: 1, shipped: 2, released: 4 };

export const EscrowTimeline = ({ status, preDispute }) => {
  const disputed = status === "disputed";
  const level = disputed ? LEVEL[preDispute] ?? 1 : LEVEL[status] ?? 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2" data-testid="escrow-timeline">
        {STEPS.map((s, i) => {
          const done = i < level;
          const current = i === level && status !== "released";
          const active = disputed ? "bg-red-200" : "bg-amber-200";
          return (
            <div key={s.label} className="flex flex-col gap-2">
              <div className={`h-1.5 rounded-full ${done ? "bg-amber-600" : current ? active : "bg-slate-200"}`} />
              <div className="flex items-center gap-1.5">
                <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${done ? "bg-amber-600 text-white" : current ? (disputed ? "bg-red-100 text-red-600 ring-2 ring-red-300" : "bg-amber-100 text-amber-700 ring-2 ring-amber-300") : "bg-slate-100 text-slate-400"}`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                </span>
                <span className={`text-[11px] leading-tight ${done || current ? "text-slate-800 font-medium" : "text-slate-400"}`}>{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      {disputed && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2" data-testid="escrow-dispute-banner">
          <ShieldAlert className="w-4 h-4 shrink-0" /> DISPUTE · Pencairan dana ke penjual dibekukan hingga mediasi selesai.
        </div>
      )}
    </div>
  );
};
