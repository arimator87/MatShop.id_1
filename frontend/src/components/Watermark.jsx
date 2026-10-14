export const Watermark = ({ small = false }) => (
  <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" data-testid="preview-watermark" aria-hidden>
    <div className="absolute inset-[-50%] flex flex-wrap content-center gap-x-10 gap-y-8 rotate-[-24deg] opacity-30">
      {Array.from({ length: small ? 18 : 48 }).map((_, i) => (
        <span key={i} className={`font-heading font-bold text-white whitespace-nowrap drop-shadow ${small ? "text-xs" : "text-lg"}`}>MatShop.id · PREVIEW</span>
      ))}
    </div>
  </div>
);
