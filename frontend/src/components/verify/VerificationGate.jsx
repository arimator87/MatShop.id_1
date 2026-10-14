import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { VerifyBadge } from "@/components/verify/VerifyBadge";

export const VERIFY_WARNING = "Profil usaha Anda harus diverifikasi oleh tim MatShop.id sebelum dapat mengajukan penawaran.";

export const useIsVerified = () => useAuth().user?.verification_status === "VERIFIED";

export const VerificationGate = ({ testid = "bid-verification-warning" }) => {
  const { user } = useAuth();
  if (user?.verification_status === "VERIFIED") return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-wrap items-start gap-3" data-testid={testid}>
      <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-[220px] space-y-2">
        <p className="text-sm font-semibold text-amber-900">{VERIFY_WARNING}</p>
        <div className="flex flex-wrap items-center gap-3">
          <VerifyBadge status={user?.verification_status} testid={`${testid}-status`} />
          {user?.verification_note && user.verification_status === "REJECTED" && <span className="text-xs text-red-700">Alasan: {user.verification_note}</span>}
        </div>
      </div>
      <Link to="/dashboard?tab=profil" data-testid={`${testid}-profile-link`}
        className="h-10 px-4 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center">
        {user?.business_profile ? "Lihat Profil Usaha" : "Lengkapi Profil Usaha"}
      </Link>
    </div>
  );
};
