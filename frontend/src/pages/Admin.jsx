import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, Gavel, Loader2, RotateCcw, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { OrderCard } from "@/components/OrderCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectReviewBoard } from "@/components/custom/ProjectReviewBoard";
import { VendorVerificationBoard } from "@/components/verify/VendorVerificationBoard";
import { TakeoverBoard } from "@/components/custom/TakeoverBoard";
import { AdminReviewBoard } from "@/components/verify/AdminReviewBoard";
import { ReviewReportBoard } from "@/components/verify/ReviewReportBoard";
import { BannerManager } from "@/components/promo/BannerManager";
import { AdManager } from "@/components/promo/AdManager";

const DECISIONS = {
  refund_buyer: { label: "Refund ke Buyer", icon: RotateCcw, cls: "bg-purple-600 hover:bg-purple-700" },
  release_vendor: { label: "Rilis Dana ke Vendor", icon: Wallet, cls: "bg-green-600 hover:bg-green-700" },
};

const ResolveDialog = ({ o, decision, onClose, onDone }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const d = DECISIONS[decision];
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/orders/${o.order_id}/resolve`, { decision, note });
      toast.success(`Mediasi ${o.order_id} selesai: ${d.label}`);
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="resolve-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{d.label} · {o.order_id}</DialogTitle>
          <DialogDescription>Nilai escrow {rupiah(o.total + (o.service_fee || 0))}. Keputusan bersifat final dan tercatat di riwayat pesanan.</DialogDescription>
        </DialogHeader>
        <textarea data-testid="resolve-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan hasil mediasi (min. 5 karakter)"
          className="w-full h-24 p-3 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
        <button data-testid="resolve-submit" onClick={submit} disabled={busy || note.trim().length < 5}
          className={`h-11 rounded-full text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 ${d.cls}`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Konfirmasi Keputusan
        </button>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ icon: Icon, label, value, testid }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <Icon className="w-5 h-5 text-amber-600 mb-3" />
    <div className="text-xs font-mono uppercase tracking-wider text-slate-500">{label}</div>
    <div className="font-heading text-2xl font-bold mt-1" data-testid={testid}>{value}</div>
  </div>
);

export default function Admin() {
  const { user } = useAuth();
  const [state, setState] = useState("open");
  const [orders, setOrders] = useState(null);
  const [stats, setStats] = useState(null);
  const [resolving, setResolving] = useState(null);

  const load = useCallback(() => {
    api.get("/admin/disputes", { params: { state } }).then(({ data }) => setOrders(data));
    api.get("/admin/stats").then(({ data }) => setStats(data));
  }, [state]);
  useEffect(() => { if (user.is_admin) load(); }, [load, user.is_admin]);

  if (!user.is_admin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8" data-testid="admin-page">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2"><Gavel className="w-4 h-4" /> Admin MatShop</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Panel Internal MatShop</h1>
        <p className="text-slate-600 mt-2">Review request proyek custom (Managed Open-Bid) dan mediasi komplain transaksi.</p>
      </div>
      <Tabs defaultValue="projects">
      <TabsList className="h-auto flex-wrap justify-start bg-[#F1EFE9] p-1 rounded-full">
        <TabsTrigger value="projects" data-testid="admin-tab-projects" className="rounded-full px-4 py-2 data-[state=active]:bg-[#1E242B] data-[state=active]:text-white">Managed Project Board</TabsTrigger>
        <TabsTrigger value="monitor" data-testid="admin-tab-monitor" className="rounded-full px-4 py-2 data-[state=active]:bg-[#1E242B] data-[state=active]:text-white">Monitoring & Takeover</TabsTrigger>
        <TabsTrigger value="vendors" data-testid="admin-tab-vendors" className="rounded-full px-4 py-2 data-[state=active]:bg-[#1E242B] data-[state=active]:text-white">Verifikasi Vendor</TabsTrigger>
        <TabsTrigger value="reviews" data-testid="admin-tab-reviews" className="rounded-full px-4 py-2 data-[state=active]:bg-[#1E242B] data-[state=active]:text-white">Ulasan Vendor</TabsTrigger>
        <TabsTrigger value="promo" data-testid="admin-tab-promo" className="rounded-full px-4 py-2 data-[state=active]:bg-[#1E242B] data-[state=active]:text-white">Banner & Iklan</TabsTrigger>
        <TabsTrigger value="disputes" data-testid="admin-tab-disputes" className="rounded-full px-4 py-2 data-[state=active]:bg-[#1E242B] data-[state=active]:text-white">Mediasi Komplain</TabsTrigger>
      </TabsList>
      <TabsContent value="projects" className="mt-6"><ProjectReviewBoard /></TabsContent>
      <TabsContent value="monitor" className="mt-6"><TakeoverBoard /></TabsContent>
      <TabsContent value="vendors" className="mt-6"><VendorVerificationBoard /></TabsContent>
      <TabsContent value="reviews" className="mt-6 space-y-10"><ReviewReportBoard /><AdminReviewBoard /></TabsContent>
      <TabsContent value="promo" className="mt-6 space-y-12"><BannerManager /><AdManager /></TabsContent>
      <TabsContent value="disputes" className="mt-6 space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={ShieldAlert} label="Komplain Terbuka" value={stats?.open ?? "-"} testid="admin-stat-open" />
        <Stat icon={Wallet} label="Dana Dibekukan" value={rupiah(stats?.frozen_amount)} testid="admin-stat-frozen" />
        <Stat icon={RotateCcw} label="Diputus Refund" value={stats?.refunded ?? "-"} testid="admin-stat-refunded" />
        <Stat icon={CheckCircle2} label="Diputus Rilis" value={stats?.released ?? "-"} testid="admin-stat-released" />
      </div>
      <div className="flex gap-2">
        {[["open", "Perlu Diputus"], ["resolved", "Selesai Dimediasi"], ["all", "Semua"]].map(([k, l]) => (
          <button key={k} data-testid={`admin-filter-${k}`} onClick={() => setState(k)}
            className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${state === k ? "bg-[#1E242B] text-white border-[#1E242B]" : "bg-white border-slate-200 hover:border-slate-400"}`}>{l}</button>
        ))}
      </div>
      {!orders ? <div className="h-40 rounded-xl bg-[#F1EFE9] animate-pulse" /> : orders.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid="admin-disputes-empty">Tidak ada komplain.</div>
      ) : (
        <div className="space-y-5" data-testid="admin-disputes-list">
          {orders.map((o) => (
            <div key={o.order_id} className="space-y-2">
              <div className="text-xs text-slate-500 font-mono">Buyer: {o.buyer_name} · Vendor: {o.seller_name}</div>
              <OrderCard o={o} asBuyer={false} actions={o.status === "disputed" && Object.entries(DECISIONS).map(([k, d]) => (
                <button key={k} data-testid={`admin-${k}-${o.order_id}`} onClick={() => setResolving({ o, decision: k })}
                  className={`h-10 px-4 rounded-full text-white text-sm font-semibold inline-flex items-center gap-1.5 ${d.cls}`}><d.icon className="w-4 h-4" />{d.label}</button>
              ))} />
            </div>
          ))}
        </div>
      )}
      </TabsContent>
      </Tabs>
      {resolving && <ResolveDialog {...resolving} onClose={() => setResolving(null)} onDone={() => { setResolving(null); load(); }} />}
    </div>
  );
}
