import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ROLE_META } from "@/lib/format";

export const OnboardingModal = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [pick, setPick] = useState("contractor_buyer");
  const [busy, setBusy] = useState(false);
  const open = !!user && !user.primary_role;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/users/onboarding", { role: pick });
      setUser(data);
      toast.success("Selamat datang di MatShop.id!");
      navigate("/dashboard");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-3xl [&>button]:hidden" data-testid="onboarding-modal">
        <DialogHeader>
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600">Langkah 1 / 1 · Onboarding</div>
          <DialogTitle className="font-heading text-2xl sm:text-3xl">Pilih Peran Utama Anda</DialogTitle>
          <DialogDescription>Satu akun untuk semua peran. Anda bisa berpindah dashboard kapan saja.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-3 gap-4 mt-2">
          {Object.entries(ROLE_META).map(([key, m]) => (
            <button key={key} type="button" data-testid={`onboarding-role-${key}`} onClick={() => setPick(key)}
              className={`text-left p-5 rounded-xl border-2 transition-colors ${pick === key ? "border-amber-600 bg-amber-50" : "border-slate-200 hover:border-slate-400"}`}>
              <m.icon className={`w-7 h-7 mb-3 ${pick === key ? "text-amber-600" : "text-slate-700"}`} />
              <div className="font-heading font-semibold text-slate-900">{m.label}</div>
              <p className="text-xs text-slate-600 mt-1 mb-3">{m.desc}</p>
              <ul className="space-y-1">
                {m.perks.map((p) => (
                  <li key={p} className="text-xs text-slate-600 flex gap-1.5"><Check className="w-3.5 h-3.5 text-green-600 shrink-0" />{p}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <button data-testid="onboarding-submit" onClick={save} disabled={busy}
          className="mt-4 h-12 rounded-full bg-[#1E242B] text-white font-semibold hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Lanjutkan sebagai {ROLE_META[pick].short}
        </button>
      </DialogContent>
    </Dialog>
  );
};
