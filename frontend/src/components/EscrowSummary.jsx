import { useEffect, useState } from "react";
import { Clock, Lock, Truck, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";

const CARDS = [
  ["awaiting_payment", "Menunggu Bayar", Clock, "text-slate-600"],
  ["held", "Dana Ditahan", Lock, "text-amber-600"],
  ["shipped", "Dikirim / Diserahkan", Truck, "text-blue-600"],
  ["released", "Dana Dirilis", Wallet, "text-green-600"],
];

export const EscrowSummary = () => {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api.get("/orders", { params: { role: "buyer" } }).then(({ data }) => setOrders(data)); }, []);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="escrow-summary">
      {CARDS.map(([status, label, Icon, cls]) => {
        const list = orders.filter((o) => o.status === status);
        return (
          <div key={status} className="bg-white rounded-xl border border-slate-200 p-5" data-testid={`escrow-summary-${status}`}>
            <Icon className={`w-5 h-5 mb-3 ${cls}`} />
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500">{label}</div>
            <div className="font-heading text-2xl font-bold mt-1">{list.length} <span className="text-sm font-normal text-slate-500">pesanan</span></div>
            <div className="text-sm font-mono text-slate-600">{rupiah(list.reduce((s, o) => s + o.total, 0))}</div>
          </div>
        );
      })}
    </div>
  );
};
