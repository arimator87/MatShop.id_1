import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { ImagesField } from "@/components/ListingForm";

const DisputeDialog = ({ o, onDone }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${o.order_id}/dispute`, { reason, evidence });
      toast.success("Komplain diajukan. Dana ditahan hingga mediasi selesai");
      setOpen(false);
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <>
      <button data-testid={`order-dispute-${o.order_id}`} onClick={() => setOpen(true)}
        className="h-10 px-5 rounded-full border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors inline-flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4" /> Ajukan Komplain
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="dispute-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Ajukan Komplain · {o.order_id}</DialogTitle>
            <DialogDescription>Status akan menjadi DISPUTE dan dana tidak akan dicairkan ke penjual hingga mediasi MatShop selesai.</DialogDescription>
          </DialogHeader>
          <textarea data-testid="dispute-reason-input" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan masalah: barang rusak, jumlah kurang, hasil desain tidak sesuai brief..."
            className="w-full h-28 p-3 rounded-lg border border-slate-300 outline-none focus:border-red-500 text-sm" />
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">Bukti foto barang rusak / kurang (maks. 6)</div>
            <ImagesField images={evidence} onChange={(v) => setEvidence(v.slice(0, 6))} testid="dispute-evidence" />
          </div>
          <button data-testid="dispute-submit" onClick={submit} disabled={busy || reason.trim().length < 5}
            className="h-11 rounded-full bg-red-600 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Kirim Komplain
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const OrderActions = ({ o, onChange }) => {
  const post = async (path, msg) => {
    try { await api.post(`/orders/${o.order_id}/${path}`); toast.success(msg); onChange(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      {o.status === "awaiting_payment" && (
        <Link to={`/bayar/${o.payment_id}`} data-testid={`order-pay-${o.order_id}`} className="h-10 px-5 rounded-full bg-amber-600 text-white text-sm font-semibold inline-flex items-center">Bayar Sekarang</Link>
      )}
      {["held", "shipped"].includes(o.status) && <DisputeDialog o={o} onDone={onChange} />}
      {o.status === "shipped" && (
        <button data-testid={`order-release-${o.order_id}`} onClick={() => post("release", "Dana dirilis ke penjual. Transaksi COMPLETED")}
          className="h-10 px-5 rounded-full bg-green-600 text-white text-sm font-semibold hover:bg-green-700">Konfirmasi & Rilis Dana</button>
      )}
      {o.status === "disputed" && (
        <button data-testid={`order-dispute-cancel-${o.order_id}`} onClick={() => post("dispute/cancel", "Komplain dibatalkan")}
          className="h-10 px-5 rounded-full border border-slate-300 text-sm font-semibold hover:border-slate-900">Batalkan Komplain</button>
      )}
    </>
  );
};
