import { BuyerOrders } from "@/components/BuyerOrders";

export default function Orders() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="orders-page">
      <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">Escrow</div>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8">Pesanan Saya</h1>
      <BuyerOrders />
    </div>
  );
}
