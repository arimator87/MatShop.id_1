import { Link } from "react-router-dom";

export const Logo = ({ dark = false }) => (
  <Link to="/" data-testid="brand-logo" className="flex items-center gap-2 group">
    <span className="relative w-9 h-9 grid place-items-center rounded-lg bg-[#1E242B] text-white font-heading font-bold text-sm overflow-hidden">
      <span className="absolute inset-x-0 bottom-0 h-1.5 bg-amber-600 transition-transform duration-300 group-hover:-translate-y-0.5" />
      M
    </span>
    <span className={`font-heading font-bold text-xl tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
      MatShop<span className="text-amber-600">.id</span>
    </span>
  </Link>
);
