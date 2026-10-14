import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { rupiah } from "@/lib/format";

const METHODS = ["BCA Virtual Account", "Mandiri Virtual Account", "BNI Virtual Account", "QRIS"];

export default function Payment() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get(`/payments/${paymentId}`).then(({ data }) => setP(data)); }, [paymentId]);

  const pay = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${paymentId}/pay`);
      toast.success("Pembayaran berhasil · Dana ditahan escrow");
      navigate("/pesanan");
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(false);
    }
  };

  if (!p) return <div className="py-32 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="max-w-xl mx-auto px-4 py-16" data-testid="payment-page">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-[#1E242B] text-white p-6 blueprint-grid-dark">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500 mb-1">Escrow Payment · Simulasi</div>
          <div className="text-sm text-slate-300">ID Pembayaran {p.payment_id}</div>
          <div className="font-heading text-4xl font-bold mt-2" data-testid="payment-amount">{rupiah(p.amount)}</div>
        </div>
        <div className="p-6 space-y-4">
          {p.status === "paid" ? (
            <div className="flex items-center gap-2 text-green-700" data-testid="payment-paid"><CheckCircle2 className="w-5 h-5" /> Sudah dibayar</div>
          ) : (
            <>
              <div className="text-sm font-medium">Metode pembayaran</div>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button key={m} data-testid={`pay-method-${m.split(" ")[0].toLowerCase()}`} onClick={() => setMethod(m)}
                    className={`p-3 rounded-lg border-2 text-sm text-left flex items-center gap-2 transition-colors ${method === m ? "border-amber-600 bg-amber-50" : "border-slate-200"}`}>
                    <Building2 className="w-4 h-4" />{m}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 flex gap-2"><Lock className="w-4 h-4 shrink-0" /> Mode demo (MOCK): tidak ada uang sungguhan yang ditarik. Dana disimulasikan ditahan sistem escrow.</p>
              <button data-testid="pay-now-button" onClick={pay} disabled={busy}
                className="h-12 w-full rounded-full bg-amber-600 text-white font-semibold hover:bg-amber-700 inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Bayar Sekarang
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
