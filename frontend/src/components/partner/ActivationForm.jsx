import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ImagesField } from "@/components/ListingForm";
import { LocationPicker } from "@/components/partner/LocationPicker";

const inputCls = "w-full h-11 px-4 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";
const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5"><div className="text-sm font-medium text-slate-700">{label}</div>{hint && <div className="text-xs text-slate-500">{hint}</div>}{children}</div>
);
const single = (setter) => (x) => setter(x[x.length - 1] || "");
const one = (v) => (v ? [v] : []);

export const ActivationForm = ({ role, init = {} }) => {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const isC = role === "contractor";
  const [f, setF] = useState({ ktp: "", selfie: "", workshop_photos: [], workshop_video: "", address: "", lat: null, lng: null, maps_url: "", ...init });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.ktp && f.selfie && (!isC || (f.workshop_photos.length && /^https?:\/\//.test(f.workshop_video) && f.address.trim().length >= 10 && (f.lat != null || f.maps_url.trim())));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = isC ? f : { ktp: f.ktp, selfie: f.selfie };
      const { data } = await api.post(`/users/activation/${isC ? "contractor" : "designer"}`, body);
      setUser(data);
      toast.success(isC ? "Form terkirim. Tim MatShop.id akan menjadwalkan survei workshop Anda." : "Form terkirim. Dokumen Anda sedang ditinjau.");
      navigate("/dashboard");
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-6" data-testid={`activation-form-${role}`}>
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-2 text-xs text-slate-500"><Lock className="w-4 h-4 text-amber-600" /> Dokumen identitas disimpan privat — hanya Anda & admin MatShop.id yang dapat melihat.</div>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Upload KTP" hint="Foto KTP jelas & terbaca, JPG/PNG maks. 8 MB"><ImagesField images={one(f.ktp)} onChange={single(set("ktp"))} testid="activation-ktp" privateUpload /></Field>
          <Field label="Foto Diri / Pasfoto" hint="Wajah terlihat jelas, disarankan sambil memegang KTP"><ImagesField images={one(f.selfie)} onChange={single(set("selfie"))} testid="activation-selfie" privateUpload /></Field>
        </div>
      </section>
      {isC && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h3 className="font-heading font-semibold">Data Workshop</h3>
          <Field label="Foto Workshop (maks. 8)" hint="Area produksi, mesin, dan hasil kerja"><ImagesField images={f.workshop_photos} onChange={(x) => set("workshop_photos")(x.slice(0, 8))} testid="activation-workshop" /></Field>
          <Field label="Link Video Workshop" hint="YouTube / Google Drive / Instagram">
            <input className={inputCls} value={f.workshop_video} onChange={(e) => set("workshop_video")(e.target.value)} placeholder="https://youtube.com/..." data-testid="activation-video-input" />
          </Field>
          <Field label="Alamat Lengkap Workshop">
            <textarea className={`${inputCls} h-24 py-3`} value={f.address} onChange={(e) => set("address")(e.target.value)} placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan, kota, provinsi" data-testid="activation-address-input" />
          </Field>
          <Field label="Titik Lokasi Workshop"><LocationPicker value={f} onChange={setF} inputCls={inputCls} /></Field>
        </section>
      )}
      <button type="submit" disabled={busy || !valid} data-testid="activation-submit"
        className="h-12 w-full rounded-full bg-amber-600 text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-50">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Kirim Form Verifikasi
      </button>
    </form>
  );
};
