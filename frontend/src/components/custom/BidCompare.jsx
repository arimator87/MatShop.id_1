import { Link } from "react-router-dom";
import { BadgeCheck, CheckCircle2, Columns3, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rupiah } from "@/lib/format";
import { RatingBadge, TopRatedBadge } from "@/components/Stars";

const BEST = "bg-green-50 text-green-800 font-semibold";

export const CompareBar = ({ n, onOpen, onClear }) => (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#1E242B] text-white rounded-full pl-5 pr-2 py-2 shadow-2xl fade-up" data-testid="compare-bar">
    <span className="text-sm">{n} penawaran dipilih{n < 2 && " · pilih min. 2"}</span>
    <button onClick={onOpen} disabled={n < 2} data-testid="compare-open"
      className="h-10 px-5 rounded-full bg-amber-500 text-[#1E242B] text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-amber-400 disabled:opacity-50">
      <Columns3 className="w-4 h-4" /> Bandingkan ({n})
    </button>
    <button onClick={onClear} data-testid="compare-clear" aria-label="Reset" className="w-10 h-10 rounded-full grid place-items-center hover:bg-white/10"><X className="w-4 h-4" /></button>
  </div>
);

const ROWS = [
  ["Harga Total", (b) => <span className="font-heading text-lg">{rupiah(b.amount)}</span>, "amount"],
  ["DP 30% (Milestone 1)", (b) => <span className="font-mono">{rupiah(Math.round(b.amount * 0.3))}</span>],
  ["Durasi Pengerjaan", (b) => `${b.duration_days} hari`, "duration"],
  ["Rating Vendor", (b) => <RatingBadge avg={b.vendor_rating || 0} count={b.vendor_review_count || 0} />, "rating"],
  ["Lencana", (b) => (b.vendor_top_rated ? <TopRatedBadge show /> : <span className="text-slate-400">—</span>)],
  ["Verifikasi", (b) => (b.vendor_verified ? <span className="inline-flex items-center gap-1 text-green-700"><BadgeCheck className="w-4 h-4" /> Terverifikasi</span> : <span className="text-red-600">Belum terverifikasi</span>)],
  ["Item RAB", (b) => `${b.rab_items.length} item`],
  ["Spesifikasi Material", (b) => b.material_spec || "—"],
  ["Catatan", (b) => b.notes || "—"],
];

const bestOf = (bids) => {
  const minA = Math.min(...bids.map((b) => b.amount));
  const minD = Math.min(...bids.map((b) => b.duration_days));
  const maxR = Math.max(...bids.map((b) => b.vendor_rating || 0));
  return { amount: (b) => b.amount === minA, duration: (b) => b.duration_days === minD, rating: (b) => maxR > 0 && (b.vendor_rating || 0) === maxR };
};

export const CompareDialog = ({ bids, onClose, onAccept }) => {
  const best = bestOf(bids);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto" data-testid="compare-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Bandingkan Penawaran</DialogTitle>
          <DialogDescription>Nilai terbaik (termurah, tercepat, rating tertinggi) disorot hijau.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px] border-collapse" data-testid="compare-table">
            <thead>
              <tr>
                <th className="w-44" />
                {bids.map((b) => (
                  <th key={b.bid_id} className="text-left p-3 align-top border-b border-slate-200" data-testid={`compare-col-${b.bid_id}`}>
                    <div className="font-heading font-semibold text-base">{b.vendor_name}</div>
                    <Link to={`/vendor/${b.vendor_id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-amber-700 hover:underline">Lihat Profil</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, render, key]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="p-3 text-xs font-mono uppercase tracking-wider text-slate-500 align-top">{label}</td>
                  {bids.map((b) => (
                    <td key={b.bid_id} data-testid={key ? `compare-${key}-${b.bid_id}` : undefined} data-best={key ? best[key](b) : undefined}
                      className={`p-3 align-top rounded-md ${key && best[key](b) ? BEST : ""}`}>{render(b)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td />
                {bids.map((b) => (
                  <td key={b.bid_id} className="p-3">
                    <button onClick={() => onAccept(b)} data-testid={`compare-accept-${b.bid_id}`}
                      className="h-10 w-full px-4 rounded-full bg-[#1E242B] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-slate-800">
                      <CheckCircle2 className="w-4 h-4" /> Pilih Pemenang & Bayar DP 30%
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
