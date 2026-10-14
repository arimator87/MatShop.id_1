import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { OrderCard } from "@/components/OrderCard";
import { TrackingUpdate } from "@/components/TrackingUpdate";

const ShipAction = ({ o, onDone, isService }) => {
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const ship = async () => {
    try {
      await api.post(`/orders/${o.order_id}/ship`, { note, deliverable_url: url || null });
      toast.success("Status diperbarui");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const needsFile = isService && o.items.some((i) => i.type === "service");
  return (
    <div className="flex flex-wrap gap-2">
      <input data-testid={`ship-note-${o.order_id}`} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={isService ? "Catatan / link preview hasil" : "No. resi / armada"}
        className="h-10 px-3 rounded-full border border-slate-300 text-sm w-56 outline-none focus:border-amber-600" />
      {needsFile && (
        <input data-testid={`ship-deliverable-${o.order_id}`} value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Link file asli (.skp/.pdf) — terbuka saat COMPLETED"
          className="h-10 px-3 rounded-full border border-slate-300 text-sm w-72 outline-none focus:border-amber-600" />
      )}
      <button data-testid={`ship-submit-${o.order_id}`} onClick={ship} disabled={note.length < 2}
        className="h-10 px-5 rounded-full bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">{isService ? "Serahkan Hasil" : "Kirim"}</button>
    </div>
  );
};

export const SellerOrders = ({ isService }) => {
  const [orders, setOrders] = useState(null);
  const load = useCallback(() => api.get("/orders", { params: { role: "seller" } })
    .then(({ data }) => setOrders(data.filter((o) => o.status !== "awaiting_payment"))), []);
  useEffect(() => { load(); }, [load]);

  if (!orders) return <div className="h-40 rounded-xl bg-[#F1EFE9] animate-pulse" />;
  if (!orders.length) return <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid="seller-orders-empty">Belum ada pesanan masuk.</div>;
  return (
    <div className="space-y-5" data-testid="seller-orders-list">
      {orders.map((o) => (
        <OrderCard key={o.order_id} o={o} asBuyer={false}
          actions={o.status === "held" ? <ShipAction o={o} onDone={load} isService={isService} />
            : o.status === "shipped" && o.shipping_method === "vendor_cargo" ? <TrackingUpdate o={o} onDone={load} /> : null} />
      ))}
    </div>
  );
};
