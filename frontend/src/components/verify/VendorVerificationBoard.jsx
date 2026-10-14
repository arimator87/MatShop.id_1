import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, MapPin, Phone, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, imgSrc } from "@/lib/api";
import { ROLE_META } from "@/lib/format";
import { VerifyBadge } from "@/components/verify/VerifyBadge";

const VendorCard = ({ v, onDone }) => {
  const [note, setNote] = useState("");
  const p = v.business_profile;
  const act = async (status) => {
    try {
      await api.post(`/admin/vendors/${v.user_id}/verify`, { status, note });
      toast.success(status === "VERIFIED" ? `${p.business_name} terverifikasi` : `${p.business_name} ditolak`);
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4" data-testid={`vendor-card-${v.user_id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-heading font-semibold text-lg flex items-center gap-2">
            {p.business_name}{v.verification_status === "VERIFIED" && <BadgeCheck className="w-5 h-5 text-green-600" data-testid={`vendor-verified-check-${v.user_id}`} />}
          </div>
          <div className="text-xs text-slate-500">{v.email} · {v.enabled_roles.map((r) => ROLE_META[r]?.short).join(", ")}</div>
        </div>
        <VerifyBadge status={v.verification_status} testid={`vendor-status-${v.user_id}`} />
      </div>
      <div className="grid sm:grid-cols-3 gap-2 text-sm text-slate-700">
        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" />{p.address}</span>
        <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" />{p.pic_name} · {p.pic_phone}</span>
        <a href={p.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-700 hover:underline truncate"><ExternalLink className="w-4 h-4" />Portofolio</a>
      </div>
      <div className="flex flex-wrap gap-2">
        {p.photos.map((src, i) => <a key={i} href={imgSrc(src)} target="_blank" rel="noreferrer"><img src={imgSrc(src)} alt="" className="w-24 h-20 rounded object-cover border" /></a>)}
      </div>
      {v.verification_note && <div className="text-xs text-slate-500">Catatan: {v.verification_note}</div>}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-dashed">
        <input data-testid={`vendor-note-${v.user_id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (wajib jika ditolak)"
          className="flex-1 min-w-[200px] h-10 px-3 rounded-full border border-slate-300 text-sm outline-none focus:border-amber-600" />
        {v.verification_status !== "VERIFIED" && (
          <button data-testid={`vendor-verify-${v.user_id}`} onClick={() => act("VERIFIED")}
            className="h-10 px-4 rounded-full bg-green-600 text-white text-sm font-semibold inline-flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" /> Verifikasi</button>
        )}
        {v.verification_status !== "REJECTED" && (
          <button data-testid={`vendor-reject-${v.user_id}`} onClick={() => act("REJECTED")}
            className="h-10 px-4 rounded-full border border-red-300 text-red-700 text-sm font-semibold inline-flex items-center gap-1.5"><ShieldX className="w-4 h-4" /> Tolak</button>
        )}
      </div>
    </div>
  );
};

export const VendorVerificationBoard = () => {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState(null);
  const load = useCallback(() => api.get("/admin/vendors", { params: { status } }).then(({ data }) => setItems(data)), [status]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-5" data-testid="vendor-verification-board">
      <div className="flex flex-wrap gap-2">
        {[["PENDING", "PENDING"], ["VERIFIED", "VERIFIED"], ["REJECTED", "REJECTED"], ["all", "Semua"]].map(([k, l]) => (
          <button key={k} data-testid={`vendor-filter-${k}`} onClick={() => setStatus(k)}
            className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${status === k ? "bg-[#1E242B] text-white border-[#1E242B]" : "bg-white border-slate-200 hover:border-slate-400"}`}>{l}</button>
        ))}
      </div>
      {!items ? <div className="h-32 rounded-xl bg-[#F1EFE9] animate-pulse" /> : items.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl text-slate-500" data-testid="vendor-empty">Tidak ada vendor.</div>
      ) : items.map((v) => <VendorCard key={v.user_id} v={v} onDone={load} />)}
    </div>
  );
};
