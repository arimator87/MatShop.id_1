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

export const STATUS_META = {
  awaiting_payment: { label: "Menunggu Pembayaran", code: "AWAITING_PAYMENT", cls: "bg-slate-100 text-slate-700" },
  held: { label: "Dana Ditahan (Escrow)", code: "ESCROW_HELD", cls: "bg-amber-100 text-amber-800" },
  shipped: { label: "Dikirim / Diserahkan", code: "SHIPPED", cls: "bg-blue-100 text-blue-800" },
  disputed: { label: "Komplain · Mediasi", code: "DISPUTE", cls: "bg-red-100 text-red-700" },
  released: { label: "Selesai · Dana Dirilis", code: "COMPLETED", cls: "bg-green-100 text-green-800" },
  refunded: { label: "Dana Dikembalikan ke Buyer", code: "REFUNDED", cls: "bg-purple-100 text-purple-800" },
};

export const TRACK_STAGES = [
  { key: "loading", label: "Muat Barang di Gudang" },
  { key: "departed", label: "Armada Berangkat dari Gudang" },
  { key: "in_transit", label: "Dalam Perjalanan" },
  { key: "arrived", label: "Tiba di Lokasi Proyek" },
];

export const SHIP_METHODS = {
  pickup: "Ambil Mandiri di Gudang Vendor",
  vendor_cargo: "Pengiriman Kargo/Armada Vendor",
};
export const CARGO_BASE_FEE = 50000;
export const SERVICE_FEE = 2500;

export const TYPE_LABEL = { material: "Material", service: "Jasa", asset: "Aset 3D" };
