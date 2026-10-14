import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, ExternalLink, Loader2, MapPin, ShoppingBag } from "lucide-react";
import { api, imgSrc } from "@/lib/api";
import { roleOf, WORK_TYPES } from "@/lib/vendor";
import { useListings } from "@/lib/useListings";
import { ListingGrid } from "@/components/ListingGrid";
import { RatingBadge, Stars } from "@/components/Stars";
import { ReviewPhotos } from "@/components/ReviewPhotos";
import { ReviewReply } from "@/components/ReviewReply";
import { useAuth } from "@/context/AuthContext";

const Gallery = ({ photos }) => {
  const [i, setI] = useState(0);
  return (
    <section className="space-y-3" data-testid="vendor-gallery">
      <div className="relative w-full h-64 sm:h-[460px] rounded-2xl overflow-hidden bg-[#F1EFE9]">
        <img src={imgSrc(photos[i])} alt="" className="absolute inset-0 w-full h-full object-cover" data-testid="vendor-main-photo" />
      </div>
      <div className="flex flex-wrap gap-2">
        {photos.map((src, k) => (
          <button key={k} onClick={() => setI(k)} data-testid={`vendor-thumb-${k}`}
            className={`w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${k === i ? "border-amber-600" : "border-transparent"}`}>
            <img src={imgSrc(src)} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
};

const Stat = ({ n, label, testid }) => <div><div className="font-heading text-2xl font-bold" data-testid={testid}>{n}</div><div className="text-xs text-slate-500">{label}</div></div>;

const Reviews = ({ v, isOwner, onReply }) => (
  <section className="grid lg:grid-cols-3 gap-8" data-testid="vendor-reviews">
    <div className="space-y-3">
      <h2 className="font-heading text-xl font-semibold">Ulasan Klien</h2>
      <div className="flex items-end gap-3"><span className="font-heading text-5xl font-bold" data-testid="vendor-rating-avg">{v.rating_avg.toFixed(1)}</span><Stars value={v.rating_avg} size="w-5 h-5" /></div>
      <div className="text-sm text-slate-500">{v.review_count} ulasan terverifikasi transaksi</div>
      {Object.entries(v.breakdown).sort((a, b) => b[0] - a[0]).map(([s, n]) => (
        <div key={s} className="flex items-center gap-2 text-xs"><span className="w-3 font-mono">{s}</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${v.review_count ? (n / v.review_count) * 100 : 0}%` }} /></div>
          <span className="w-4 text-right font-mono text-slate-500">{n}</span></div>
      ))}
    </div>
    <div className="lg:col-span-2 space-y-4">
      {v.reviews.length === 0 && <div className="py-10 text-center border border-dashed rounded-xl text-slate-500" data-testid="vendor-no-reviews">Belum ada ulasan.</div>}
      {v.reviews.map((r) => (
        <article key={r.review_id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-2" data-testid={`vendor-review-${r.review_id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-slate-400 font-mono">{new Date(r.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span></div>
          <p className="text-slate-700 leading-relaxed">"{r.comment}"</p>
          <ReviewPhotos photos={r.photos} testid={`vendor-review-photos-${r.review_id}`} />
          <div className="text-xs text-slate-500"><b className="text-slate-700">{r.reviewer_name}</b> · {r.subject}</div>
          <ReviewReply r={r} isOwner={isOwner} onSaved={onReply} />
        </article>
      ))}
    </div>
  </section>
);

const Header = ({ v }) => {
  const r = roleOf(v.primary_role);
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="space-y-3">
        <div className="text-[11px] font-mono uppercase tracking-widest text-amber-700 flex items-center gap-1.5"><r.icon className="w-4 h-4" />{r.label} · Terverifikasi MatShop.id</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight flex items-center gap-3" data-testid="vendor-name">{v.business_name}<BadgeCheck className="w-8 h-8 text-green-600 shrink-0" data-testid="vendor-verified-badge" /></h1>
        <div className="text-sm text-slate-600 flex items-center gap-1" data-testid="vendor-city"><MapPin className="w-4 h-4" />{v.address}</div>
        <RatingBadge avg={v.rating_avg} count={v.review_count} testid="vendor-rating-badge" />
        <div className="flex flex-wrap gap-1.5">{v.work_types.map((w) => <span key={w} className="text-xs px-2.5 py-1 rounded-full bg-[#F1EFE9]">{WORK_TYPES[w]}</span>)}</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/custom-project/ajukan" data-testid="vendor-cta-request" className="h-12 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700">Ajukan Proyek <ArrowRight className="w-4 h-4" /></Link>
        <a href="#vendor-listings" data-testid="vendor-cta-order" className="h-12 px-6 rounded-full bg-[#1E242B] text-white font-semibold inline-flex items-center gap-2 hover:bg-slate-800"><ShoppingBag className="w-4 h-4" /> Order Produk / Jasa</a>
        <a href={v.portfolio_url} target="_blank" rel="noreferrer" data-testid="vendor-cta-external" className="h-12 px-6 rounded-full border border-slate-300 font-semibold inline-flex items-center gap-2 hover:border-slate-900"><ExternalLink className="w-4 h-4" /> Portofolio Eksternal</a>
      </div>
    </div>
  );
};

export default function VendorProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [v, setV] = useState(null);
  const { items, loading } = useListings({ owner: id, limit: 24 });
  useEffect(() => { api.get(`/vendors/${id}`).then(({ data }) => setV(data)).catch(() => setV(false)); }, [id]);
  if (v === false) return <div className="py-32 text-center" data-testid="vendor-not-found">Profil vendor tidak ditemukan.</div>;
  if (!v) return <div className="py-32 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12" data-testid="vendor-profile-page">
      <Header v={v} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 border-y border-slate-200 py-6">
        <Stat n={v.photos.length} label="Foto karya" />
        <Stat n={v.completed_projects} label="Proyek custom selesai" testid="vendor-stat-projects" />
        <Stat n={v.completed_orders} label="Pesanan selesai" />
        <Stat n={v.listings} label="Listing aktif" />
      </div>
      <Gallery photos={v.photos} />
      <Reviews v={v} isOwner={user?.user_id === v.user_id} onReply={(nr) => setV({ ...v, reviews: v.reviews.map((r) => (r.review_id === nr.review_id ? nr : r)) })} />
      <section id="vendor-listings" className="space-y-4 scroll-mt-24">
        <h2 className="font-heading text-xl font-semibold">Produk & Jasa dari {v.business_name}</h2>
        {!loading && !items.length ? <div className="py-10 text-center border border-dashed rounded-xl text-slate-500">Vendor ini belum memiliki listing. Ajukan proyek custom untuk bekerja sama.</div>
          : <ListingGrid items={items} loading={loading} testid="vendor-listings" />}
      </section>
    </div>
  );
}
