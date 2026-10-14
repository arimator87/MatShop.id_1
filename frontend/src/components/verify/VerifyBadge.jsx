import { BadgeCheck, Clock, ShieldX, UserPlus } from "lucide-react";

export const VERIFY_META = {
  NONE: { label: "Belum Mengisi Profil", icon: UserPlus, cls: "bg-slate-100 text-slate-700" },
  PENDING: { label: "PENDING · Menunggu Verifikasi", icon: Clock, cls: "bg-amber-100 text-amber-800" },
  VERIFIED: { label: "VERIFIED · Terverifikasi", icon: BadgeCheck, cls: "bg-green-100 text-green-800" },
  REJECTED: { label: "REJECTED · Ditolak", icon: ShieldX, cls: "bg-red-100 text-red-700" },
};

export const VerifyBadge = ({ status, testid = "verify-badge" }) => {
  const m = VERIFY_META[status || "NONE"];
  return (
    <span data-testid={testid} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${m.cls}`}>
      <m.icon className="w-3.5 h-3.5" /> {m.label}
    </span>
  );
};
