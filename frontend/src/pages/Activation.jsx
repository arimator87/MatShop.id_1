import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ROLE_META } from "@/lib/format";
import { PARTNER_ROLE } from "@/lib/partner";
import { ActivationForm } from "@/components/partner/ActivationForm";
import { PartnerStatusCard } from "@/components/partner/PartnerStatus";

export default function Activation() {
  const { slug } = useParams();
  const { user } = useAuth();
  const role = PARTNER_ROLE[slug];
  const [editing, setEditing] = useState(false);
  if (!role) return <Navigate to="/dashboard" replace />;
  const meta = ROLE_META[role];
  const v = user.role_verifications?.[role];
  const showForm = !v || editing;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8" data-testid={`activation-page-${slug}`}>
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-2"><meta.icon className="w-4 h-4" /> Aktivasi Peran</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Form Verifikasi {role === "contractor" ? "Kontraktor / Workshop" : "Desainer 3D / Kreator"}</h1>
        <p className="text-slate-600 mt-2 max-w-2xl">
          {role === "contractor"
            ? "Lengkapi dokumen identitas & data workshop. Tim MatShop.id memverifikasi dokumen lalu menjadwalkan survei ke lokasi workshop sebelum Anda menjadi Verified Partner."
            : "Upload KTP & foto diri. Tim MatShop.id meninjau dokumen sebelum profil Anda mendapat badge terverifikasi."}
        </p>
      </div>
      {v && <PartnerStatusCard role={role} v={v} onResubmit={() => setEditing(true)} />}
      {showForm && <ActivationForm role={role} init={editing && v ? { ...v, ktp: "", selfie: "" } : {}} />}
    </div>
  );
}
