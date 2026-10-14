export const PARTNER_ROLE = { desainer: "designer_creator", kontraktor: "contractor" };
export const CONTRACTOR_MSG = "Profil Anda sedang ditinjau. Tim MatShop.id akan melakukan verifikasi dokumen dan menjadwalkan kunjungan/survei ke lokasi Workshop Anda.";

export const PARTNER_STATUS = {
  PENDING_DESIGNER_VERIFICATION: { label: "Menunggu Verifikasi KTP", cls: "bg-amber-100 text-amber-800" },
  PENDING_SURVEY_VERIFICATION: { label: "Menunggu Jadwal Survei", cls: "bg-amber-100 text-amber-800" },
  SURVEY_SCHEDULED: { label: "Survei Dijadwalkan", cls: "bg-blue-100 text-blue-800" },
  VERIFIED: { label: "Verified Partner", cls: "bg-green-100 text-green-800" },
  REJECTED: { label: "Ditolak", cls: "bg-red-100 text-red-700" },
};

export const parseCoords = (text) => {
  const s = (text || "").trim();
  const m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

export const osmEmbed = (lat, lng) => `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.006},${lat - 0.004},${lng + 0.006},${lat + 0.004}&layer=mapnik&marker=${lat},${lng}`;
export const mapsLink = (v) => (v.lat != null ? `https://www.google.com/maps?q=${v.lat},${v.lng}` : v.maps_url);
export const fmtSurvey = (s) => s && `${new Date(`${s.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${s.time} WIB`;
