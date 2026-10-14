import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { imgSrc } from "@/lib/api";

export const ReviewPhotos = ({ photos, testid }) => {
  const [open, setOpen] = useState(null);
  if (!photos?.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2" data-testid={testid}>
        {photos.map((src, k) => (
          <button key={k} type="button" onClick={() => setOpen(src)} data-testid={`${testid}-${k}`}
            className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-amber-600 transition-colors">
            <img src={imgSrc(src)} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl p-2" data-testid="review-photo-lightbox">
          <DialogTitle className="sr-only">Foto ulasan</DialogTitle>
          {open && <img src={imgSrc(open)} alt="" className="w-full max-h-[80vh] object-contain rounded-md" />}
        </DialogContent>
      </Dialog>
    </>
  );
};
