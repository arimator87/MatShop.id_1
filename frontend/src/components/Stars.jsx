import { Star } from "lucide-react";

export const Stars = ({ value, size = "w-4 h-4", testid }) => (
  <span className="inline-flex items-center gap-0.5" data-testid={testid} aria-label={`${value} dari 5`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} className={`${size} ${s <= Math.round(value) ? "fill-amber-500 text-amber-500" : "text-slate-300"}`} />
    ))}
  </span>
);

export const RatingBadge = ({ avg, count, testid }) => (
  <span className="inline-flex items-center gap-1.5 text-xs" data-testid={testid}>
    <Stars value={avg} size="w-3.5 h-3.5" />
    {count > 0 ? <><b className="font-mono">{avg.toFixed(1)}</b><span className="text-slate-500">({count} ulasan)</span></> : <span className="text-slate-500">Belum ada ulasan</span>}
  </span>
);

export const StarInput = ({ value, onChange }) => (
  <div className="flex gap-1" data-testid="review-star-input">
    {[1, 2, 3, 4, 5].map((s) => (
      <button type="button" key={s} onClick={() => onChange(s)} data-testid={`review-star-${s}`} className="transition-transform hover:scale-110">
        <Star className={`w-8 h-8 ${s <= value ? "fill-amber-500 text-amber-500" : "text-slate-300"}`} />
      </button>
    ))}
  </div>
);
