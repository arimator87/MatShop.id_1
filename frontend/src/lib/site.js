export const IMAGE_SLOTS = {
  hero_main: { label: "Hero — Foto Utama", where: "Beranda, kiri besar di area hero", size: "1200 × 1400 px (rasio ±6:7, portrait)",
    url: "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600" },
  hero_material: { label: "Hero — Foto Material", where: "Beranda, kotak kanan atas di area hero", size: "600 × 600 px (rasio 1:1)",
    url: "https://images.unsplash.com/photo-1627590720218-c5ed819dae7e?crop=entropy&cs=srgb&fm=jpg&q=85&w=700" },
  custom_banner: { label: "Banner Custom Furniture", where: "Beranda, sisi kanan banner gelap Custom Furniture", size: "1000 × 800 px (rasio 5:4)",
    url: "https://images.unsplash.com/photo-1722605090433-41d1183a792d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400" },
  login_side: { label: "Halaman Login", where: "Login, gambar samping (desktop)", size: "1200 × 1600 px (rasio 3:4, portrait)",
    url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" },
};

export const PWA_DEFAULT = {
  app_name: "MatShop.id",
  short_name: "MatShop",
  banner_title: "Install aplikasi MatShop.id",
  banner_text: "Belanja material & pantau proyek lebih cepat langsung dari layar HP.",
};

export const PWA_FIELDS = [
  ["app_name", "Nama aplikasi (saat install)", 40],
  ["short_name", "Nama pendek (di bawah ikon HP)", 12],
  ["banner_title", "Judul banner install", 60],
  ["banner_text", "Teks banner install", 120],
];

export const HERO_DEFAULT = {
  eyebrow: "Marketplace B2B · B2C · Designer",
  title: "Material, desain, dan aset 3D",
  highlight: "dalam satu meja gambar.",
  subtitle: "MatShop.id mempertemukan Supplier Material, Kontraktor, dan Desainer Interior/Arsitek — dengan harga grosir bertingkat dan pembayaran escrow yang aman.",
};

export const HERO_FIELDS = [
  ["eyebrow", "Label kecil di atas judul", 60],
  ["title", "Judul utama", 80],
  ["highlight", "Judul lanjutan (warna oranye)", 60],
  ["subtitle", "Deskripsi", 300],
];

export const SECTION_LABELS = {
  custom_banner: "Banner Custom Furniture & Fit-Out",
  portfolio: "Portofolio Kontraktor & Desainer",
  catalog: "Jelajahi Katalog (+ iklan sponsor)",
  ads_strip_a: "Strip Iklan Sponsor A",
  popular: "Material Populer (+ iklan sponsor)",
  creator: "Jasa Desain & Aset 3D (+ iklan sponsor)",
  ads_strip_b: "Strip Iklan Sponsor B",
  escrow: "Penjelasan Escrow Payment",
};

export const DEFAULT_SECTIONS = Object.keys(SECTION_LABELS).map((key) => ({ key, visible: true }));

export const SIZE_GUIDE = [
  ["Pop-up Banner", "800 × 1200 px (2:3, portrait)", "JPG/PNG/WebP, maks. 2 MB, teks penting di area tengah"],
  ["Iklan Sponsor (kartu & strip)", "1200 × 900 px (4:3)", "Objek utama di tengah; strip lebar menampilkan gambar di kiri + teks di kanan"],
  ["Foto Hero Utama", "1200 × 1400 px (±6:7)", "Bagian bawah tertutup kartu Escrow, hindari teks di 25% bawah"],
  ["Foto Hero Material", "600 × 600 px (1:1)", "Tekstur/close-up material"],
  ["Banner Custom Furniture", "1000 × 800 px (5:4)", "Foto interior/kitchen set"],
  ["Halaman Login", "1200 × 1600 px (3:4)", "Hanya tampil di desktop"],
  ["Ikon Aplikasi HP (PWA)", "512 × 512 px (1:1), PNG", "Persegi penuh tanpa sudut membulat; logo di tengah, sisakan margin ±10%"],
];
