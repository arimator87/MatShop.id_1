import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, Download, FileBox, RefreshCw, ShieldCheck, ShoppingCart, Star, Warehouse } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { rupiah, TYPE_LABEL } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { TierCalculator } from "@/components/TierCalculator";

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 text-sm py-2">
    <Icon className="w-4 h-4 text-slate-500" /><span className="text-slate-600 w-36">{label}</span><span className="font-medium">{value}</span>
  </div>
);

const Gallery = ({ images, title }) => {
  const [i, setI] = useState(0);
  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F1EFE9] border border-slate-200">
        <img src={imgSrc(images?.[i])} alt={title} className="w-full h-full object-cover" data-testid="detail-main-image" />
      </div>
      <div className="flex gap-3">
        {images?.map((src, k) => (
          <button key={k} onClick={() => setI(k)} data-testid={`detail-thumb-${k}`}
            className={`w-20 h-16 rounded-lg overflow-hidden border-2 ${k === i ? "border-amber-600" : "border-transparent"}`}>
            <img src={imgSrc(src)} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [l, setL] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => { api.get(`/listings/${id}`).then(({ data }) => setL(data)).catch(() => setL(false)); }, [id]);

  if (l === false) return <div className="py-32 text-center" data-testid="detail-not-found">Produk tidak ditemukan.</div>;
  if (!l) return <div className="max-w-7xl mx-auto p-8"><div className="h-96 rounded-2xl bg-[#F1EFE9] animate-pulse" /></div>;

  const buy = async (go) => { if ((await add(l.listing_id, qty)) && go) navigate("/keranjang"); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid lg:grid-cols-12 gap-10" data-testid="listing-detail-page">
      <div className="lg:col-span-7 space-y-8">
        <Gallery images={l.images} title={l.title} />
        <div>
          <h2 className="font-heading text-xl font-semibold mb-3">Deskripsi</h2>
          <p className="text-slate-600 leading-relaxed">{l.description}</p>
        </div>
        {l.specs && Object.keys(l.specs).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100" data-testid="detail-specs">
            {Object.entries(l.specs).map(([k, v]) => (
              <div key={k} className="flex px-5 py-3 text-sm"><span className="w-40 text-slate-500">{k}</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </div>
      <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24 self-start">
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600">{TYPE_LABEL[l.type]} · {l.category_label}</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight" data-testid="detail-title">{l.title}</h1>
          <div className="text-sm text-slate-600 flex items-center gap-2">
            {l.owner_name}{l.rating > 0 && <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-amber-500 text-amber-500" />{l.rating}</span>}<span>· {l.sold} terjual</span>
          </div>
          <div className="font-heading text-3xl font-bold" data-testid="detail-price">{rupiah(l.price)} <span className="text-base font-normal text-slate-500">/ {l.unit}</span></div>
        </div>
        {l.type === "material" && (
          <>
            <InfoRow icon={Warehouse} label="Stok tersedia" value={`${l.stock?.toLocaleString("id-ID")} ${l.unit}`} />
            {l.tiers?.length > 0 ? <TierCalculator l={l} qty={qty} setQty={setQty} /> : null}
          </>
        )}
        {l.type === "service" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <InfoRow icon={Clock} label="Estimasi pengerjaan" value={`${l.delivery_days} hari kerja`} />
            <InfoRow icon={RefreshCw} label="Revisi" value={`${l.revisions}x`} />
          </div>
        )}
        {l.type === "asset" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <InfoRow icon={FileBox} label="Format file" value={l.file_format} />
            <InfoRow icon={Download} label="Ukuran" value={l.file_size} />
            <p className="text-xs text-blue-700 bg-blue-50 rounded-md p-3 mt-2">Tombol unduh otomatis muncul di halaman Pesanan setelah pembayaran berhasil.</p>
          </div>
        )}
        <div className="flex items-start gap-3 text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
          Dilindungi Escrow Payment: dana ditahan sistem dan baru dirilis ke penjual setelah Anda konfirmasi.
        </div>
        <div className="flex gap-3">
          <button data-testid="add-to-cart-button" onClick={() => buy(false)}
            className="flex-1 h-12 rounded-full border border-slate-900 font-semibold inline-flex items-center justify-center gap-2 hover:bg-slate-900 hover:text-white transition-colors">
            <ShoppingCart className="w-4 h-4" /> Keranjang
          </button>
          <button data-testid="buy-now-button" onClick={() => buy(true)}
            className="flex-1 h-12 rounded-full bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors">
            {l.type === "service" ? "Pesan Jasa" : "Beli Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );
}
