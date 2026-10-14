import { useState } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ImagesField } from "@/components/ListingForm";
import { VerifyBadge } from "@/components/verify/VerifyBadge";
import { WORK_TYPES } from "@/lib/vendor";

const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const L = ({ label, children, cls = "" }) => <label className={`block space-y-1.5 ${cls}`}><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;
const EMPTY = { business_name: "", address: "", portfolio_url: "", photos: [], pic_name: "", pic_phone: "", city: "", work_types: [] };

export const BusinessProfileForm = () => {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ ...EMPTY, ...(user.business_profile || {}) });
  const [busy, setBusy] = useState(false);
  const toggle = (w) => setF({ ...f, work_types: f.work_types.includes(w) ? f.work_types.filter((x) => x !== w) : [...f.work_types, w] });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.business_name.trim().length >= 2 && f.address.trim().length >= 5 && f.portfolio_url.trim().length >= 5
    && f.photos.length > 0 && f.pic_name.trim().length >= 2 && f.pic_phone.trim().length >= 6;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { submitted_at, ...body } = f;
      const { data } = await api.put("/users/business-profile", body);
      setUser(data);
      toast.success("Profil dikirim. Status: PENDING menunggu verifikasi tim MatShop.id");
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-6 max-w-4xl" data-testid="business-profile-form">
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-amber-600" />
          <div>
            <div className="font-heading font-semibold">Status Verifikasi</div>
            <div className="text-xs text-slate-500">Wajib VERIFIED sebelum bisa mengajukan penawaran proyek.</div>
          </div>
        </div>
        <VerifyBadge status={user.verification_status} testid="profile-verify-status" />
        {user.verification_status === "REJECTED" && user.verification_note && (
          <div className="w-full text-sm text-red-700 bg-red-50 rounded-md p-3" data-testid="profile-reject-note">Alasan penolakan: {user.verification_note}. Perbarui data lalu kirim ulang.</div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 grid sm:grid-cols-2 gap-4">
        <L label="Nama Usaha"><input required className={inputCls} value={f.business_name} onChange={set("business_name")} data-testid="profile-business-name-input" /></L>
        <L label="Link Portofolio"><input required className={inputCls} value={f.portfolio_url} onChange={set("portfolio_url")} placeholder="https://instagram.com/workshop-anda" data-testid="profile-portfolio-input" /></L>
        <L label="Alamat Workshop / Kantor" cls="sm:col-span-2"><input required className={inputCls} value={f.address} onChange={set("address")} data-testid="profile-address-input" /></L>
        <L label="Kota"><input className={inputCls} value={f.city} onChange={set("city")} placeholder="mis. Bandung" data-testid="profile-city-input" /></L>
        <div className="space-y-1.5"><span className="text-sm font-medium text-slate-700">Jenis Pekerjaan</span>
          <div className="flex flex-wrap gap-2" data-testid="profile-work-types">
            {Object.entries(WORK_TYPES).map(([k, l]) => (
              <button type="button" key={k} onClick={() => toggle(k)} data-testid={`profile-work-type-${k}`}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${f.work_types.includes(k) ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300 hover:border-slate-500"}`}>{l}</button>
            ))}
          </div>
        </div>
        <L label="Nama PIC"><input required className={inputCls} value={f.pic_name} onChange={set("pic_name")} data-testid="profile-pic-name-input" /></L>
        <L label="Kontak PIC (HP / WhatsApp)"><input required className={inputCls} value={f.pic_phone} onChange={set("pic_phone")} data-testid="profile-pic-phone-input" /></L>
        <L label="Foto Hasil Pekerjaan (min. 1, maks. 10)" cls="sm:col-span-2">
          <ImagesField images={f.photos} onChange={(photos) => setF({ ...f, photos: photos.slice(0, 10) })} testid="profile-photo" />
        </L>
      </div>
      <button type="submit" disabled={busy || !valid} data-testid="profile-submit-button"
        className="h-12 px-8 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} {user.business_profile ? "Perbarui & Ajukan Ulang Verifikasi" : "Kirim untuk Verifikasi"}
      </button>
      {user.verification_status === "VERIFIED" && <p className="text-xs text-slate-500">Mengubah profil akan mengembalikan status ke PENDING hingga ditinjau ulang.</p>}
    </form>
  );
};
