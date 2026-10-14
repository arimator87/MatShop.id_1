import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export const SectionHeader = ({ eyebrow, title, to, testid }) => (
  <div className="flex items-end justify-between gap-4 mb-8">
    <div>
      <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">{eyebrow}</div>
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">{title}</h2>
    </div>
    {to && (
      <Link to={to} data-testid={testid} className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-amber-700 transition-colors">
        Lihat semua <ArrowUpRight className="w-4 h-4" />
      </Link>
    )}
  </div>
);
