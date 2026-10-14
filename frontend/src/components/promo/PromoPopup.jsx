import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { api, imgSrc } from "@/lib/api";

export const openLink = (url, nav) => {
  if (!url) return;
  if (url.startsWith("/")) nav(url);
  else window.open(url, "_blank", "noopener,noreferrer");
};

const key = (b) => `mshop_popup_${b.banner_id}_${b.updated_at}`;

export const PromoPopup = () => {
  const [b, setB] = useState(null);
  const [dontShow, setDontShow] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    api.get("/banners/active").then(({ data }) => {
      if (data && !localStorage.getItem(key(data)) && !sessionStorage.getItem(key(data))) setB(data);
    }).catch(() => {});
  }, []);
  if (!b) return null;
  const close = () => {
    sessionStorage.setItem(key(b), "1");
    if (dontShow) localStorage.setItem(key(b), "1");
    setB(null);
  };
  const click = () => { if (b.link_url) { close(); openLink(b.link_url, nav); } };
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] grid place-items-center p-6 fade-up" data-testid="promo-popup" onClick={close}>
      <div className="relative w-full max-w-[380px]" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} data-testid="promo-popup-close" aria-label="Tutup"
          className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-white text-slate-900 grid place-items-center shadow-lg hover:scale-110 transition-transform z-10">
          <X className="w-5 h-5" />
        </button>
        <img src={imgSrc(b.image)} alt={b.name} onClick={click} data-testid="promo-popup-image"
          className={`w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl ${b.link_url ? "cursor-pointer" : ""}`} />
        <label className="mt-3 flex items-center justify-center gap-2 text-sm text-white/90 cursor-pointer select-none">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="accent-amber-500 w-4 h-4" data-testid="promo-popup-dont-show" />
          Jangan tampilkan lagi
        </label>
      </div>
    </div>
  );
};
