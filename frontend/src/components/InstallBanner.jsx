import { useEffect, useState } from "react";
import { Download, MoreVertical, PlusSquare, Share, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { imgSrc } from "@/lib/api";
import { installApp, isIOS, setGuide, usePWA } from "@/lib/pwa";
import { PWA_DEFAULT } from "@/lib/site";
import { useSite } from "@/context/SiteContext";

const KEY = "mshop_install_dismissed";
const WEEK = 7 * 24 * 3600 * 1000;

const Step = ({ icon: I, children }) => (
  <li className="flex items-start gap-3"><span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 grid place-items-center shrink-0"><I className="w-4 h-4" /></span><span className="pt-1.5">{children}</span></li>
);

const InstallGuide = ({ name }) => {
  const { guide } = usePWA();
  const ios = isIOS();
  return (
    <Dialog open={guide} onOpenChange={(o) => !o && setGuide(false)}>
      <DialogContent className="max-w-sm" data-testid="install-guide">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Install {name}</DialogTitle>
          <DialogDescription>{ios ? "Di iPhone/iPad, buka lewat Safari lalu:" : "Buka menu browser lalu:"}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm" data-testid={ios ? "install-guide-ios" : "install-guide-android"}>
          {ios ? <>
            <Step icon={Share}>Ketuk tombol <b>Bagikan</b> di bawah layar</Step>
            <Step icon={PlusSquare}>Pilih <b>Tambah ke Layar Utama</b></Step>
            <Step icon={Download}>Ketuk <b>Tambah</b> — ikon MatShop muncul di layar HP</Step>
          </> : <>
            <Step icon={MoreVertical}>Ketuk menu <b>⋮</b> di pojok kanan atas Chrome</Step>
            <Step icon={Download}>Pilih <b>Install aplikasi</b> / <b>Tambahkan ke layar utama</b></Step>
          </>}
        </ol>
      </DialogContent>
    </Dialog>
  );
};

export const InstallBanner = () => {
  const { raw } = useSite();
  const pwa = { ...PWA_DEFAULT, ...(raw.pwa || {}) };
  const { canPrompt, standalone } = usePWA();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const link = document.querySelector('link[rel="apple-touch-icon"]');
    if (link && raw.pwa?.icon) link.href = imgSrc(raw.pwa.icon);
  }, [raw.pwa?.icon]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const dismissed = Number(localStorage.getItem(KEY) || 0) > Date.now() - WEEK;
    if (!mobile || standalone || dismissed || !(canPrompt || isIOS())) return setShow(false);
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [canPrompt, standalone]);
  const close = () => { localStorage.setItem(KEY, String(Date.now())); setShow(false); };
  return (
    <>
      {show && (
        <div className="fixed inset-x-3 bottom-3 z-40 rounded-2xl bg-[#1E242B] text-white shadow-2xl p-3 pr-2 flex items-center gap-3 fade-up" style={{ marginBottom: "env(safe-area-inset-bottom)" }} data-testid="install-banner">
          <img src={pwa.icon ? imgSrc(pwa.icon) : "/icons/icon-192.png"} alt="" className="w-11 h-11 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight" data-testid="install-banner-title">{pwa.banner_title}</div>
            <div className="text-[11px] text-slate-300 leading-snug line-clamp-2">{pwa.banner_text}</div>
          </div>
          <button onClick={() => { installApp(); setShow(false); }} data-testid="install-banner-button" className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-semibold shrink-0">Install</button>
          <button onClick={close} aria-label="Tutup" data-testid="install-banner-close" className="w-8 h-8 grid place-items-center text-slate-400 shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}
      <InstallGuide name={pwa.app_name} />
    </>
  );
};
