import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const VERIFY_WARNING = "Aktifkan peran Kontraktor / Workshop (isi form verifikasi) untuk mengajukan penawaran.";

export const useIsVerified = () => !!useAuth().user?.enabled_roles?.includes("contractor");

export const VerificationGate = ({ testid = "bid-verification-warning" }) => {
  const { user } = useAuth();
  const v = user?.role_verifications?.contractor;
  if (v?.status === "VERIFIED") return null;
  if (user?.enabled_roles?.includes("contractor")) return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900" data-testid={`${testid}-unverified`}>
      Penawaran Anda tampil dengan badge <b>"Belum Terverifikasi"</b> sampai survei workshop selesai. Verified Partner lebih dipercaya klien.
    </div>
  );
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-wrap items-center gap-3" data-testid={testid}>
      <Lock className="w-5 h-5 text-amber-700 shrink-0" />
      <p className="flex-1 min-w-[220px] text-sm font-semibold text-amber-900">{VERIFY_WARNING}</p>
      <Link to="/aktivasi/kontraktor" data-testid={`${testid}-profile-link`} className="h-10 px-4 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center">Aktifkan Kontraktor</Link>
    </div>
  );
};
