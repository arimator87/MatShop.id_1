import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Package, Store, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ROLE_META, rupiah } from "@/lib/format";
import { MyListings } from "@/components/MyListings";
import { SellerOrders } from "@/components/SellerOrders";
import { BuyerOrders } from "@/components/BuyerOrders";

const Stat = ({ icon: Icon, label, value, testid }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5">
    <Icon className="w-5 h-5 text-amber-600 mb-3" />
    <div className="text-xs font-mono uppercase tracking-wider text-slate-500">{label}</div>
    <div className="font-heading text-2xl font-bold mt-1" data-testid={testid}>{value}</div>
  </div>
);

const SellerDash = ({ types, isService }) => {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/seller/stats").then(({ data }) => setS(data)); }, []);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Lock} label="Dana Ditahan Escrow" value={rupiah(s?.held)} testid="stat-held" />
        <Stat icon={Wallet} label="Dana Dirilis" value={rupiah(s?.released)} testid="stat-released" />
        <Stat icon={Package} label="Perlu Diproses" value={s?.pending_action ?? "-"} testid="stat-pending" />
        <Stat icon={Store} label="Listing Aktif" value={s?.listings ?? "-"} testid="stat-listings" />
      </div>
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings" data-testid="dash-tab-listings">{isService ? "Etalase Jasa & Aset 3D" : "Kelola Stok & Harga"}</TabsTrigger>
          <TabsTrigger value="orders" data-testid="dash-tab-orders">Pesanan Masuk</TabsTrigger>
        </TabsList>
        <TabsContent value="listings" className="mt-6"><MyListings types={types} /></TabsContent>
        <TabsContent value="orders" className="mt-6"><SellerOrders isService={isService} /></TabsContent>
      </Tabs>
    </div>
  );
};

const SUPPLIER_TYPES = ["material"];
const DESIGNER_TYPES = ["service", "asset"];

export default function Dashboard() {
  const { user } = useAuth();
  const role = user.active_role;
  if (!role) return <div className="min-h-[50vh]" />;
  const meta = ROLE_META[role];
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid={`dashboard-${role}`}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2"><meta.icon className="w-4 h-4" /> Dashboard {meta.label}</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Halo, {user.name.split(" ")[0]}</h1>
          <p className="text-slate-600 mt-2">{meta.desc}</p>
        </div>
        {role === "contractor_buyer" && <Link to="/katalog?tab=all" data-testid="dash-explore-button" className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center">Eksplorasi Material</Link>}
      </div>
      {role === "supplier_vendor" && <SellerDash types={SUPPLIER_TYPES} />}
      {role === "designer_creator" && <SellerDash types={DESIGNER_TYPES} isService />}
      {role === "contractor_buyer" && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">Riwayat Pesanan Escrow & Unduhan Aset</h2>
          <BuyerOrders />
        </div>
      )}
    </div>
  );
}
