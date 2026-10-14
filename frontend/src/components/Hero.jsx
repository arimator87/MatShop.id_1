import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Layers, Boxes } from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";
const MAT = "https://images.unsplash.com/photo-1627590720218-c5ed819dae7e?crop=entropy&cs=srgb&fm=jpg&q=85&w=700";

const stats = [
  ["2.400+", "SKU Material"],
  ["350+", "Desainer & Arsitek"],
  ["100%", "Transaksi Escrow"],
];

export const Hero = () => (
  <section className="relative overflow-hidden blueprint-grid border-b border-slate-200">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
      <div className="lg:col-span-6 space-y-7">
        <div className="fade-up inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> Marketplace B2B · B2C · Kreator
        </div>
        <h1 className="fade-up text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]" style={{ animationDelay: "80ms" }}>
          Material, desain, dan aset 3D <span className="text-amber-600">dalam satu meja gambar.</span>
        </h1>
        <p className="fade-up text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed" style={{ animationDelay: "160ms" }}>
          MatShop.id mempertemukan Supplier Material, Kontraktor, dan Desainer Interior/Arsitek — dengan harga grosir bertingkat dan pembayaran escrow yang aman.
        </p>
        <div className="fade-up flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
          <Link to="/katalog?tab=all" data-testid="hero-cta-materials"
            className="h-12 px-6 inline-flex items-center gap-2 rounded-full bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors">
            Belanja Material <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/katalog?tab=services" data-testid="hero-cta-services"
            className="h-12 px-6 inline-flex items-center rounded-full border border-slate-300 bg-white font-semibold text-slate-800 hover:border-slate-900 transition-colors">
            Cari Jasa Desain & RAB
          </Link>
        </div>
        <div className="fade-up grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 max-w-lg" style={{ animationDelay: "320ms" }}>
          {stats.map(([n, l]) => (
            <div key={l}>
              <div className="font-heading text-2xl font-bold text-slate-900">{n}</div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-500">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-6 grid grid-cols-6 grid-rows-6 gap-4 h-[420px] sm:h-[520px]">
        <div className="col-span-4 row-span-6 rounded-2xl overflow-hidden relative fade-up" style={{ animationDelay: "120ms" }}>
          <img src={HERO} alt="Interior arsitektural" className="w-full h-full object-cover" />
          <div className="absolute bottom-4 left-4 right-4 bg-white/85 backdrop-blur-md rounded-xl p-4 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-amber-600 shrink-0" />
            <div>
              <div className="font-heading font-semibold text-sm text-slate-900">Escrow Payment</div>
              <div className="text-xs text-slate-600">Dana ditahan sistem sampai pesanan Anda terima.</div>
            </div>
          </div>
        </div>
        <div className="col-span-2 row-span-3 rounded-2xl overflow-hidden fade-up" style={{ animationDelay: "200ms" }}>
          <img src={MAT} alt="Plywood" className="w-full h-full object-cover" />
        </div>
        <div className="col-span-2 row-span-3 rounded-2xl bg-[#1E242B] text-white p-4 flex flex-col justify-between fade-up blueprint-grid-dark" style={{ animationDelay: "280ms" }}>
          <div className="flex gap-2"><Layers className="w-5 h-5 text-amber-500" /><Boxes className="w-5 h-5 text-slate-400" /></div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Harga Grosir</div>
            <div className="font-heading text-xl font-bold leading-tight">Hemat s/d 15% untuk &gt;50 lembar</div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
