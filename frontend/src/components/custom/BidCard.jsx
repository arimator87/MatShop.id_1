import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { rupiah } from "@/lib/format";
import { RatingBadge } from "@/components/Stars";

export const BidCard = ({ bid, canAccept, onAccept }) => {
  const [open, setOpen] = useState(false);
  const badge = { accepted: "bg-green-100 text-green-800", rejected: "bg-slate-100 text-slate-500", pending: "bg-amber-100 text-amber-800" }[bid.status];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3" data-testid={`bid-card-${bid.bid_id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-heading font-semibold">{bid.vendor_name}</div>
          <div className="flex flex-wrap items-center gap-2 my-1">
            <RatingBadge avg={bid.vendor_rating || 0} count={bid.vendor_review_count || 0} testid={`bid-rating-${bid.bid_id}`} />
            <Link to={`/vendor/${bid.vendor_id}`} target="_blank" rel="noopener noreferrer" data-testid={`bid-vendor-profile-${bid.bid_id}`} className="text-xs font-semibold text-amber-700 hover:underline">Lihat Profil</Link>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {bid.duration_days} hari pengerjaan · {bid.rab_items.length} item RAB</div>
        </div>
        <div className="text-right">
          <div className="font-heading text-xl font-bold" data-testid={`bid-amount-${bid.bid_id}`}>{rupiah(bid.amount)}</div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge}`}>{{ accepted: "Diterima", rejected: "Tidak dipilih", pending: "Menunggu" }[bid.status]}</span>
        </div>
      </div>
      {bid.material_spec && <div className="text-sm bg-[#F8F7F4] border border-slate-200 rounded-md p-3" data-testid={`bid-spec-${bid.bid_id}`}><span className="text-[10px] font-mono uppercase text-slate-500 block">Spesifikasi material</span>{bid.material_spec}</div>}
      {bid.notes && <p className="text-sm text-slate-600">{bid.notes}</p>}
      <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-amber-700" data-testid={`bid-toggle-rab-${bid.bid_id}`}>{open ? "Sembunyikan" : "Lihat"} rincian RAB</button>
      {open && (
        <table className="w-full text-xs" data-testid={`bid-rab-${bid.bid_id}`}>
          <tbody className="divide-y divide-slate-100">
            {bid.rab_items.map((i, k) => (
              <tr key={k}><td className="py-1.5">{i.item}</td><td className="text-right font-mono">{i.qty} {i.unit}</td><td className="text-right font-mono">{rupiah(i.price)}</td><td className="text-right font-mono">{rupiah(i.subtotal)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {canAccept && bid.status === "pending" && (
        <button onClick={() => onAccept(bid)} data-testid={`bid-accept-${bid.bid_id}`}
          className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Pilih Pemenang & Bayar DP 30% ({rupiah(Math.round(bid.amount * 0.3))})</button>
      )}
    </div>
  );
};
