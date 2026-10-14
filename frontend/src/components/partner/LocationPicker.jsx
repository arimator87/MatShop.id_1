import { useState } from "react";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { osmEmbed, parseCoords } from "@/lib/partner";

export const MapPreview = ({ lat, lng, testid = "map-preview", cls = "h-56" }) => (
  <iframe title="Peta lokasi workshop" src={osmEmbed(lat, lng)} data-testid={testid} className={`w-full ${cls} rounded-lg border border-slate-200`} loading="lazy" />
);

export const LocationPicker = ({ value, onChange, inputCls }) => {
  const [busy, setBusy] = useState(false);
  const gps = () => {
    if (!navigator.geolocation) return toast.error("Browser tidak mendukung GPS");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { onChange({ ...value, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }); setBusy(false); },
      () => { toast.error("Izin lokasi ditolak. Tempel link Google Maps / koordinat."); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const paste = (text) => {
    const c = parseCoords(text);
    onChange({ ...value, maps_url: text, ...(c || (text.trim() ? {} : { lat: null, lng: null })) });
  };
  return (
    <div className="space-y-3" data-testid="location-picker">
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={gps} disabled={busy} data-testid="location-gps-button"
          className="h-11 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />} Gunakan Lokasi Saya
        </button>
        <input className={inputCls} value={value.maps_url} onChange={(e) => paste(e.target.value)} data-testid="location-maps-input"
          placeholder="atau tempel link Google Maps / koordinat, mis. -6.6106, 110.6776" />
      </div>
      {value.lat != null ? (
        <>
          <div className="text-xs font-mono text-slate-600 flex items-center gap-1" data-testid="location-coords"><MapPin className="w-3.5 h-3.5 text-amber-600" /> {value.lat}, {value.lng}</div>
          <MapPreview lat={value.lat} lng={value.lng} />
        </>
      ) : value.maps_url ? <p className="text-xs text-slate-500" data-testid="location-link-only">Link disimpan. Pratinjau peta tersedia jika link memuat koordinat (buka Google Maps → bagikan → salin link lengkap).</p> : null}
    </div>
  );
};
