import { Link } from "react-router-dom";
import { ArrowRight, Calculator, Hammer } from "lucide-react";

const IMG = "https://images.unsplash.com/photo-1722605090433-41d1183a792d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400";

export const CustomBanner = () => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16" data-testid="custom-project-banner">
    <div className="relative rounded-2xl overflow-hidden bg-[#1E242B] text-white grid lg:grid-cols-12 blueprint-grid-dark">
      <div className="lg:col-span-7 p-8 sm:p-12 space-y-5 relative z-10">
        <div className="text-xs font-mono uppercase tracking-widest text-amber-500 flex items-center gap-2"><Hammer className="w-4 h-4" /> Untuk Klien Rumah & Apartemen</div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Custom Furniture & Interior Fit-Out</h2>
        <p className="text-slate-300 max-w-lg">Pesan Kitchen Set, Wardrobe, hingga interior apartemen/rumah. Hitung estimasi biaya, terima penawaran RAB dari workshop terverifikasi, bayar bertahap lewat Escrow Milestone 30% · 40% · 30%.</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/custom-project" data-testid="custom-banner-calc-button"
            className="h-12 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700 transition-colors">
            <Calculator className="w-4 h-4" /> Hitung Estimasi
          </Link>
          <Link to="/custom-project/ajukan" data-testid="custom-banner-request-button"
            className="h-12 px-6 rounded-full border border-white/30 font-semibold inline-flex items-center gap-2 hover:border-white transition-colors">
            Ajukan Proyek Custom <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      <div className="lg:col-span-5 min-h-[220px]">
        <img src={IMG} alt="Kitchen set custom" className="w-full h-full object-cover" />
      </div>
    </div>
  </section>
);
