import { ChefHat, DoorClosed, Sofa } from "lucide-react";

export const WORK_TYPES = {
  kitchen_set: { label: "Kitchen Set", unit: "m_lari", icon: ChefHat, hint: "Panjang kabinet (meter lari)" },
  wardrobe: { label: "Wardrobe / Lemari Tanam", unit: "m_lari", icon: DoorClosed, hint: "Lebar lemari (meter lari)" },
  full_interior: { label: "Fit-Out Apartemen/Rumah", unit: "m2", icon: Sofa, hint: "Luas ruangan (m²)" },
};
export const UNIT_LABEL = { m_lari: "meter lari", m2: "m²" };
export const FINISHING = {
  hpl: { label: "HPL", desc: "High Pressure Laminate · tahan gores, motif kayu/solid, lebih ekonomis" },
  duco: { label: "Duco", desc: "Cat duco premium · permukaan mulus glossy/doff, warna custom" },
};
export const MILESTONES = [
  { key: "m1", label: "DP & Survey Lokasi", pct: 30 },
  { key: "m2", label: "Fabrikasi Workshop", pct: 40 },
  { key: "m3", label: "Pemasangan di Lokasi & Serah Terima", pct: 30 },
];
export const PROJECT_STATUS = {
  pending_review: { code: "PENDING_REVIEW_INTERNAL", label: "Ditinjau Tim MatShop", cls: "bg-slate-100 text-slate-700" },
  rejected: { code: "REJECTED", label: "Ditolak", cls: "bg-red-100 text-red-700" },
  open: { code: "OPEN_FOR_BID", label: "Menerima Penawaran", cls: "bg-amber-100 text-amber-800" },
  awarded: { code: "AWARDED", label: "Pemenang Dipilih · Menunggu DP", cls: "bg-blue-100 text-blue-800" },
  in_progress: { code: "IN_PROGRESS", label: "Dalam Pengerjaan", cls: "bg-blue-100 text-blue-800" },
  internal_takeover: { code: "INTERNAL_TAKEOVER", label: "Diambil Alih Master Workshop MatShop", cls: "bg-red-100 text-red-700" },
  completed: { code: "COMPLETED", label: "Selesai · Serah Terima", cls: "bg-green-100 text-green-800" },
  cancelled: { code: "CANCELLED", label: "Dibatalkan", cls: "bg-slate-100 text-slate-600" },
};
export const MS_STATUS = {
  pending: { label: "Belum Dibayar", cls: "text-slate-500" },
  held: { label: "Dana Ditahan · Dikerjakan", cls: "text-amber-700" },
  submitted: { label: "Menunggu Persetujuan Klien", cls: "text-blue-700" },
  released: { label: "Dana Dirilis", cls: "text-green-700" },
};
