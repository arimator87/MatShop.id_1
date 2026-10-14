import { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { api } from "@/lib/api";
import { OrderCard } from "@/components/OrderCard";
import { OrderActions } from "@/components/OrderActions";

export const BuyerOrders = ({ filter }) => {
  const [orders, setOrders] = useState(null);
  const load = useCallback(() => api.get("/orders", { params: { role: "buyer" } })
    .then(({ data }) => setOrders(filter ? data.filter(filter) : data)), [filter]);
  useEffect(() => { load(); }, [load]);

  if (!orders) return <div className="h-40 rounded-xl bg-[#F1EFE9] animate-pulse" />;
  if (!orders.length)
    return (
      <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl" data-testid="orders-empty">
        <Package className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <p className="text-slate-600">Belum ada pesanan.</p>
      </div>
    );
  return (
    <div className="space-y-5" data-testid="buyer-orders-list">
      {orders.map((o) => <OrderCard key={o.order_id} o={o} actions={<OrderActions o={o} onChange={load} />} />)}
    </div>
  );
};
