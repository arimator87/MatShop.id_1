import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, ShoppingCart } from "lucide-react";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

const links = [
  { to: "/katalog?tab=all", label: "Material", id: "nav-materials" },
  { to: "/katalog?tab=services", label: "Jasa Desain", id: "nav-services" },
  { to: "/katalog?tab=assets", label: "Aset 3D", id: "nav-assets" },
];

export const Navbar = () => {
  const { user, loading } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e) => {
    e.preventDefault();
    navigate(`/katalog?tab=${q ? "" : "all"}&q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.id} to={l.to} data-testid={l.id}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors">
              {l.label}
            </NavLink>
          ))}
        </nav>
        <form onSubmit={submit} className="hidden lg:flex flex-1 max-w-md items-center gap-2 h-10 px-3 rounded-full bg-[#F1EFE9] border border-transparent focus-within:border-amber-500 transition-colors">
          <Search className="w-4 h-4 text-slate-500" />
          <input data-testid="nav-search-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Cari plywood, SPC, jasa RAB, aset .skp..."
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-slate-400" />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/keranjang" data-testid="nav-cart-button"
            className="relative w-10 h-10 grid place-items-center rounded-full hover:bg-slate-100 transition-colors">
            <ShoppingCart className="w-5 h-5 text-slate-700" />
            {cart.lines > 0 && (
              <span data-testid="nav-cart-count"
                className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-amber-600 text-white text-[11px] font-mono grid place-items-center">
                {cart.lines}
              </span>
            )}
          </Link>
          {!loading && (user ? <UserMenu /> : (
            <Link to="/login" data-testid="nav-login-button"
              className="h-10 px-5 inline-flex items-center rounded-full bg-[#1E242B] text-white text-sm font-semibold hover:bg-slate-800 transition-colors">
              Masuk
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
};
