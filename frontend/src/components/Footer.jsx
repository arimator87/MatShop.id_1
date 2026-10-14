import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Footer = () => (
  <footer className="bg-[#1E242B] text-slate-400 mt-24 blueprint-grid-dark">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-4">
      <div className="md:col-span-2 space-y-4">
        <Logo dark />
        <p className="text-sm max-w-sm leading-relaxed">
          Marketplace hibrida B2B/B2C untuk material finishing interior, jasa desain profesional, dan aset file 3D.
        </p>
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-500">
          <ShieldCheck className="w-4 h-4" /> Escrow Payment · Dana ditahan sistem
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="text-white font-heading font-semibold mb-3">Material</div>
        <p>Plywood / Multiplek · HPL</p><p>SPC Flooring · Marmer</p><p>WallPanel · Lis Profil</p>
      </div>
      <div className="space-y-2 text-sm">
        <div className="text-white font-heading font-semibold mb-3">Kreator Hub</div>
        <p>Desain 3D Render</p><p>Gambar Kerja (DED) · RAB</p><p>Aset .skp · D5 · FBX</p>
      </div>
    </div>
    <div className="border-t border-white/10 py-5 text-center text-xs font-mono">© 2026 MatShop.id</div>
  </footer>
);
