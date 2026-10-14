import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BusinessProfileForm } from "@/components/verify/BusinessProfileForm";
import { VerifyBadge } from "@/components/verify/VerifyBadge";
import { Lock, Package, ShieldAlert, Store, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ROLE_META, rupiah } from "@/lib/format";
import { MyListings } from "@/components/MyListings";
import { SellerOrders } from "@/components/SellerOrders";
import { BuyerOrders } from "@/components/BuyerOrders";
import { PurchasedAssets } from "@/components/PurchasedAssets";
import { EscrowSummary } from "@/components/EscrowSummary";
import { MyCustomProjects, ProjectOpportunities } from "@/components/custom/ProjectLists";
import { FavoriteVendors } from "@/components/FavoriteVendors";
import { AdStrip } from "@/components/promo/AdStrip";

const MATERIAL = ["material"];
const ASSET = ["asset"];
const SERVICE = ["service"];
const hasMaterial = (o) => o.items.some((i) => i.type === "material");

const PROFILE_TAB = { key: "profil", label: "Profil Usaha & Portofolio", el: <BusinessProfileForm /> };

const TAB_CONFIG = {
  supplier_vendor: [
    { key: "stok", label: "Stok Material", el: <MyListings types={MATERIAL} /> },
    { key: "pesanan", label: "Pesanan Masuk", el: <SellerOrders /> },
    { key: "peluang", label: "Project Board", el: <ProjectOpportunities /> },
    PROFILE_TAB,
  ],
  designer_creator: [
    { key: "aset", label: "Aset 3D Saya", el: <MyListings types={ASSET} /> },
    { key: "jasa", label: "Layanan Jasa", el: <MyListings types={SERVICE} /> },
    { key: "penjualan", label: "Penjualan Digital", el: <SellerOrders isService /> },
    PROFILE_TAB,
  ],
  contractor_buyer: [
    { key: "material", label: "Pesanan Material", el: <BuyerOrders filter={hasMaterial} /> },
    { key: "aset", label: "Aset Digital Terbeli", el: <PurchasedAssets /> },
    { key: "escrow", label: "Status Escrow Payment", el: <div className="space-y-6"><EscrowSummary /><BuyerOrders /></div> },
    { key: "custom", label: "Proyek Custom Saya", el: <MyCustomProjects /> },
    { key: "favorit", label: "Vendor Favorit", el: <FavoriteVendors /> },
    { key: "peluang", label: "Project Board", el: <ProjectOpportunities /> },
    PROFILE_TAB,
  ],
};

const Stat = ({ icon: Icon, label, value, testid }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <Icon className="w-5 h-5 text-amber-600 mb-3" />
    <div className="text-xs font-mono uppercase tracking-wider text-slate-500">{label}</div>
    <div className="font-heading text-2xl font-bold mt-1" data-testid={testid}>{value}</div>
  </div>
);

const SellerStats = () => {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/seller/stats").then(({ data }) => setS(data)); }, []);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <Stat icon={Lock} label="Dana Ditahan Escrow" value={rupiah(s?.held)} testid="stat-held" />
      <Stat icon={Wallet} label="Dana Dirilis" value={rupiah(s?.released)} testid="stat-released" />
      <Stat icon={Package} label="Perlu Diproses" value={s?.pending_action ?? "-"} testid="stat-pending" />
      <Stat icon={ShieldAlert} label="Dalam Mediasi" value={s?.disputed ?? "-"} testid="stat-disputed" />
      <Stat icon={Store} label="Listing Aktif" value={s?.listings ?? "-"} testid="stat-listings" />
    </div>
  );
};

const RoleTabs = ({ role }) => {
  const tabs = TAB_CONFIG[role];
  const [sp, setSp] = useSearchParams();
  const value = tabs.some((t) => t.key === sp.get("tab")) ? sp.get("tab") : tabs[0].key;
  return (
    <Tabs key={role} value={value} onValueChange={(v) => setSp({ tab: v }, { replace: true })} data-testid={`dashboard-tabs-${role}`}>
      <TabsList className="h-auto flex-wrap justify-start bg-[#F1EFE9] p-1 rounded-full">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key} data-testid={`dash-tab-${role}-${t.key}`}
            className="rounded-full px-4 py-2 data-[state=active]:bg-[#1E242B] data-[state=active]:text-white">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => <TabsContent key={t.key} value={t.key} className="mt-6">{t.el}</TabsContent>)}
    </Tabs>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const role = user.active_role || user.primary_role;
  if (!role) return <div className="min-h-[50vh]" />;
  const meta = ROLE_META[role];
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid={`dashboard-${role}`}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2"><meta.icon className="w-4 h-4" /> Dashboard {meta.label}</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Halo, {user.name.split(" ")[0]}</h1>
          <p className="text-slate-600 mt-2">{meta.desc}</p>
          {(role !== "contractor_buyer" || user.business_profile) && <div className="mt-3"><VerifyBadge status={user.verification_status} testid="dashboard-verify-badge" /></div>}
        </div>
        {role === "contractor_buyer" && <Link to="/katalog?tab=all" data-testid="dash-explore-button" className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center">Eksplorasi Material</Link>}
      </div>
      {user.suspended && (
        <div className="mb-8 rounded-xl border-2 border-red-300 bg-red-50 p-5 text-sm text-red-900" data-testid="suspended-banner">
          <b>Akun dibekukan (suspended).</b> {user.suspended_reason} — Anda tidak dapat mengajukan penawaran atau melanjutkan proyek. Hubungi tim MatShop.id.
        </div>
      )}
      {role !== "contractor_buyer" && <SellerStats key={role} />}
      <AdStrip placement="dashboard" slot={0} testid="dashboard-ad-top" cls="mb-8" />
      <RoleTabs role={role} />
      <AdStrip placement="dashboard" slot={1} testid="dashboard-ad-bottom" cls="mt-12" />
    </div>
  );
}
