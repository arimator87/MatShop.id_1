import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Truck, PackageCheck, Wallet } from "lucide-react";
import { Hero } from "@/components/Hero";
import { CustomBanner } from "@/components/custom/CustomBanner";
import { PortfolioSection } from "@/components/PortfolioSection";
import { CatalogTabs } from "@/components/CatalogTabs";
import { ListingGrid } from "@/components/ListingGrid";
import { SectionHeader } from "@/components/SectionHeader";
import { useListings } from "@/lib/useListings";

const ESCROW = [
  [Lock, "Bayar ke Escrow", "Dana Anda ditahan sistem MatShop, belum diteruskan ke penjual."],
  [Truck, "Pengiriman / Pengerjaan", "Supplier kirim material, desainer serahkan hasil pekerjaan."],
  [PackageCheck, "Konfirmasi Buyer", "Cek barang/hasil desain, lalu konfirmasi penerimaan."],
  [Wallet, "Dana Dirilis", "Dana otomatis dirilis ke penjual setelah konfirmasi."],
];

const CatalogSection = () => {
  const [tab, setTab] = useState("all");
  const { items, loading } = useListings({ tab, limit: 8 });
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16" data-testid="home-catalog-section">
      <SectionHeader eyebrow="Katalog" title="Jelajahi Katalog MatShop" to={`/katalog?tab=${tab}`} testid="home-catalog-see-all" />
      <div className="mb-8"><CatalogTabs value={tab} onChange={setTab} /></div>
      <ListingGrid items={items} loading={loading} testid="home-catalog-grid" />
    </section>
  );
};

const Popular = () => {
  const { items, loading } = useListings({ tab: "all", sort: "popular", limit: 4 });
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24" data-testid="popular-materials-section">
      <SectionHeader eyebrow="B2B · Harga Grosir" title="Material Populer untuk Kontraktor" to="/katalog?tab=all" testid="popular-see-all" />
      <ListingGrid items={items} loading={loading} testid="popular-grid" />
    </section>
  );
};

const CreatorPicks = () => {
  const s = useListings({ type: "service", sort: "popular", limit: 4 });
  const a = useListings({ type: "asset", sort: "popular", limit: 4 });
  return (
    <section className="mt-24 bg-[#F1EFE9] border-y border-slate-200" data-testid="creator-picks-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-12">
        <SectionHeader eyebrow="Desainer & Kreator Hub" title="Jasa Desain & Aset 3D Pilihan" to="/katalog?tab=services" testid="creator-see-all" />
        <ListingGrid items={s.items} loading={s.loading} testid="services-grid" />
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl font-semibold text-slate-800">Aset File 3D · .skp · D5 · FBX · Textures</h3>
          <Link to="/katalog?tab=assets" data-testid="assets-see-all" className="text-sm font-semibold text-amber-700 hover:underline">Semua aset</Link>
        </div>
        <ListingGrid items={a.items} loading={a.loading} testid="assets-grid" />
      </div>
    </section>
  );
};

const EscrowStrip = () => (
  <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24" data-testid="escrow-explainer">
    <SectionHeader eyebrow="Escrow Payment" title="Pembayaran Ditahan Sistem, Proyek Tetap Aman" />
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
      {ESCROW.map(([Icon, t, d], i) => (
        <div key={t} className="bg-white p-6 space-y-3">
          <div className="flex items-center justify-between">
            <Icon className="w-6 h-6 text-amber-600" />
            <span className="font-mono text-xs text-slate-400">0{i + 1}</span>
          </div>
          <div className="font-heading font-semibold text-slate-900">{t}</div>
          <p className="text-sm text-slate-600">{d}</p>
        </div>
      ))}
    </div>
  </section>
);

export default function Home() {
  return (
    <div data-testid="home-page">
      <Hero />
      <CustomBanner />
      <PortfolioSection />
      <CatalogSection />
      <Popular />
      <CreatorPicks />
      <EscrowStrip />
    </div>
  );
}
