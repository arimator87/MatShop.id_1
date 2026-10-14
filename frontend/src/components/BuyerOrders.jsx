import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { OrderCard } from "@/components/OrderCard";

export const BuyerOrders = () => {
  const [orders, setOrders] = useState(null);
  const load = useCallback(() => api.get("/orders", { params: { role: "buyer" } }).then(({ data }) => setOrders(data)), []);
  useEffect(() => { load(); }, [load]);

  const release = async (id) => {
    try {
      await api.post(`/orders/${id}/release`);
      toast.success("Dana dirilis ke penjual. Terima kasih!");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

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
      {orders.map((o) => (
        <OrderCard key={o.order_id} o={o} actions={
          <>
            {o.status === "awaiting_payment" && (
              <Link to={`/bayar/${o.payment_id}`} data-testid={`order-pay-${o.order_id}`} className="h-10 px-5 rounded-full bg-amber-600 text-white text-sm font-semibold inline-flex items-center">Bayar Sekarang</Link>
            )}
            {o.status === "shipped" && (
              <button data-testid={`order-release-${o.order_id}`} onClick={() => release(o.order_id)}
                className="h-10 px-5 rounded-full bg-green-600 text-white text-sm font-semibold hover:bg-green-700">Konfirmasi & Rilis Dana</button>
            )}
          </>
        } />
      ))}
    </div>
  );
};
