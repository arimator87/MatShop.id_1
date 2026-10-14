import { useEffect, useState } from "react";
import { Loader2, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { StarInput, Stars } from "@/components/Stars";
import { ImagesField } from "@/components/ListingForm";
import { ReviewPhotos } from "@/components/ReviewPhotos";

const Box = ({ children, testid }) => (
  <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-testid={testid}>
    <div className="text-xs font-mono uppercase tracking-wider text-amber-700 flex items-center gap-1.5"><MessageSquareQuote className="w-4 h-4" /> Rating & Ulasan Vendor</div>
    {children}
  </section>
);

export const ReviewForm = ({ source, refId }) => {
  const [review, setReview] = useState(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/reviews/ref/${refId}`).then(({ data }) => setReview(data)); }, [refId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/reviews", { source, ref_id: refId, rating, comment, photos });
      setReview(data);
      toast.success("Terima kasih! Ulasan Anda tampil di profil vendor");
    } catch (err) { toast.error(errMsg(err)); }
    setBusy(false);
  };

  if (review === undefined) return null;
  if (review) return (
    <Box testid="review-submitted">
      <Stars value={review.rating} size="w-5 h-5" />
      <p className="text-slate-700 italic">"{review.comment}"</p>
      <ReviewPhotos photos={review.photos} testid="review-submitted-photos" />
      <p className="text-xs text-slate-500">Ulasan Anda sudah terkirim · {new Date(review.created_at).toLocaleDateString("id-ID")}</p>
    </Box>
  );
  return (
    <Box testid="review-form">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">Transaksi selesai. Bagaimana hasil kerja vendor? Ulasan Anda membantu klien lain memilih.</p>
        <StarInput value={rating} onChange={setRating} />
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} data-testid="review-comment-input"
          placeholder="Ceritakan kualitas pekerjaan, ketepatan waktu, dan komunikasi vendor (min. 10 karakter)"
          className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Foto hasil pekerjaan (opsional, maks. 4)</span>
          <ImagesField images={photos} onChange={(x) => setPhotos(x.slice(0, 4))} testid="review-photo" />
        </div>
        <button type="submit" disabled={busy || !rating || comment.trim().length < 10} data-testid="review-submit-button"
          className="h-11 px-6 rounded-full bg-amber-600 text-white font-semibold inline-flex items-center gap-2 hover:bg-amber-700 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Kirim Ulasan
        </button>
      </form>
    </Box>
  );
};
