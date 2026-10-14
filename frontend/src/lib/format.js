import { HardHat, Truck, PenTool } from "lucide-react";

export const rupiah = (n) =>
  "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export const unitPrice = (listing, qty) => {
  let p = listing.price;
  [...(listing.tiers || [])].sort((a, b) => a.min_qty - b.min_qty).forEach((t) => {
    if (qty >= t.min_qty) p = t.price;
  });
  return p;
};

export const ROLE_META = {
  contractor_buyer: { label: "Kontraktor / Buyer", short: "Kontraktor", icon: HardHat,
    desc: "Eksplorasi material, harga grosir, pesan jasa desain & beli aset 3D.",
    perks: ["Harga grosir otomatis >50 unit", "Escrow: dana aman sampai barang diterima", "Unduh aset 3D instan"] },
  supplier_vendor: { label: "Supplier / Vendor", short: "Supplier", icon: Truck,
    desc: "Kelola stok material & atur harga eceran vs grosir untuk kontraktor.",
    perks: ["Kelola stok Plywood, SPC, WallPanel", "Atur tier harga grosir", "Terima pesanan B2B"] },
  designer_creator: { label: "Desainer / Arsitek", short: "Desainer", icon: PenTool,
    desc: "Jual jasa desain 3D, gambar kerja (DED), RAB & aset file 3D.",
    perks: ["Etalase jasa profesional", "Jual aset .skp, D5, FBX", "Pembayaran via escrow"] },
};

export const TABS = [
  { key: "all", label: "Semua Material" },
  { key: "plywood", label: "Plywood & Sheet" },
  { key: "spc", label: "SPC & Flooring" },
  { key: "wallpanel", label: "WallPanel & WPC" },
  { key: "services", label: "Jasa Desain 3D & RAB" },
  { key: "assets", label: "Aset File 3D" },
];

export const STATUS_META = {
  awaiting_payment: { label: "Menunggu Pembayaran", cls: "bg-slate-100 text-slate-700" },
  held: { label: "Dana Ditahan (Escrow)", cls: "bg-amber-100 text-amber-800" },
  shipped: { label: "Dikirim / Diserahkan", cls: "bg-blue-100 text-blue-800" },
  released: { label: "Selesai · Dana Dirilis", cls: "bg-green-100 text-green-800" },
};

export const TYPE_LABEL = { material: "Material", service: "Jasa", asset: "Aset 3D" };
