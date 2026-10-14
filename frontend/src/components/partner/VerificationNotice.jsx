import { Link } from "react-router-dom";
import { BadgeCheck, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ROLE_META } from "@/lib/format";
import { PartnerStatusCard } from "@/components/partner/PartnerStatus";

export const VerificationNotice = ({ role }) => {
  const { user } = useAuth();
  const meta = ROLE_META[role];
  if (!meta.gated) {
    if (role !== "supplier_vendor" || user.verification_status === "VERIFIED") return null;
    return (
      <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-5 flex flex-wrap gap-4 items-center" data-testid="supplier-verify-notice">
        <Info className="w-5 h-5 text-amber-700 shrink-0" />
        <p className="flex-1 min-w-[220px] text-sm text-amber-900">Toko Anda sudah aktif. Lengkapi <b>Profil Usaha & Portofolio</b> agar mendapat badge terverifikasi dan meningkatkan kepercayaan pelanggan.</p>
        <Link to="/dashboard?tab=profil" className="h-10 px-4 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center" data-testid="supplier-verify-link">Lengkapi Profil</Link>
      </div>
    );
  }
  const v = user.role_verifications?.[role];
  if (!v || v.status === "VERIFIED") return null;
  return (
    <div className="mb-8 space-y-3" data-testid="partner-verify-notice">
      <div className="text-sm text-slate-700 flex items-start gap-2"><BadgeCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <span>Anda tetap bisa memakai fitur {meta.short} dengan badge <b>"Belum Terverifikasi"</b>. Segerakan verifikasi agar profil Anda lebih dipercaya pelanggan dan tampil di Portofolio.</span>
      </div>
      <PartnerStatusCard role={role} v={v} testid="dashboard-partner-status" onResubmit={() => window.location.assign(`/aktivasi/${meta.gated}`)} />
    </div>
  );
};
