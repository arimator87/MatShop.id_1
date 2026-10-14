import { useEffect, useState } from "react";
import { Armchair, Bath, BedDouble, Brush, ChefHat, DoorClosed, Hammer, Lamp, LayoutGrid, PaintRoller, Ruler, Sofa, Tv, Warehouse } from "lucide-react";
import { api } from "@/lib/api";

export const ICONS = { ChefHat, DoorClosed, Sofa, PaintRoller, Hammer, Armchair, Bath, BedDouble, Brush, Lamp, LayoutGrid, Ruler, Tv, Warehouse };

let cache = null;
let pending = null;
export const resetCustomConfig = () => { cache = null; pending = null; };
export const useCustomConfig = () => {
  const [cfg, setCfg] = useState(cache);
  useEffect(() => {
    if (cache) return setCfg(cache);
    if (!pending) pending = api.get("/custom/config").then(({ data }) => { cache = data; return data; }).catch(() => { pending = null; return null; });
    let alive = true;
    pending.then((d) => alive && d && setCfg(d));
    return () => { alive = false; };
  }, []);
  return cfg;
};

export const sizeText = (p) => (p.size_label ? `${p.size_label}${p.size ? ` → ${p.size.toLocaleString("id-ID")} ${p.unit_label}` : ""}` : "");

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
