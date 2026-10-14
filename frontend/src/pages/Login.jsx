import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ROLE_META } from "@/lib/format";
import { Logo } from "@/components/Logo";

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
);

const IMG = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/dashboard" replace />;

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const demo = async (role) => {
    try {
      const { data } = await api.post("/auth/demo", { role });
      setUser(data.user);
      toast.success(`Masuk sebagai demo ${ROLE_META[role]?.short || "Admin"}`);
      navigate(role === "admin" ? "/admin" : "/dashboard");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid lg:grid-cols-2 gap-10 items-center" data-testid="login-page">
      <div className="space-y-8 max-w-md">
        <Logo />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Masuk / Daftar</h1>
          <p className="text-slate-600 mt-3">Satu akun untuk semua peran — Kontraktor, Supplier, dan Desainer. Pilih peran utama setelah login pertama.</p>
        </div>
        <button data-testid="google-login-button" onClick={google}
          className="w-full h-12 rounded-full border border-slate-300 bg-white font-semibold inline-flex items-center justify-center gap-3 hover:border-slate-900 transition-colors">
          <GoogleIcon /> Continue with Google
        </button>
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-500">Atau coba akun demo</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ROLE_META).map(([k, m]) => (
              <button key={k} data-testid={`demo-login-${k}`} onClick={() => demo(k)}
                className="p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-600 transition-colors text-left">
                <m.icon className="w-5 h-5 text-amber-600 mb-2" />
                <div className="text-xs font-semibold">{m.short}</div>
              </button>
            ))}
          </div>
          <button data-testid="demo-login-admin" onClick={() => demo("admin")}
            className="w-full h-10 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-amber-600 transition-colors">
            Masuk sebagai Admin Mediasi (demo)
          </button>
        </div>
      </div>
      <div className="hidden lg:block rounded-2xl overflow-hidden h-[560px]"><img src={IMG} alt="" className="w-full h-full object-cover" /></div>
    </div>
  );
}
