import { useState } from "react";
import { CornerDownRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

export const ReviewReply = ({ r, isOwner, onSaved }) => {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(r.reply?.text || "");
  const [busy, setBusy] = useState(false);
  const id = r.review_id;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/reviews/${id}/reply`, { text });
      onSaved(data);
      setEdit(false);
      toast.success("Balasan tersimpan");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  if (edit) return (
    <div className="space-y-2 pt-2" data-testid={`reply-form-${id}`}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} data-testid={`reply-input-${id}`}
        placeholder="Tulis balasan untuk klien..." className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:border-amber-600 text-sm" />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy || text.trim().length < 3} data-testid={`reply-save-${id}`}
          className="h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Kirim Balasan
        </button>
        <button onClick={() => setEdit(false)} className="h-9 px-4 rounded-full border border-slate-300 text-xs" data-testid={`reply-cancel-${id}`}>Batal</button>
      </div>
    </div>
  );
  return (
    <>
      {r.reply && (
        <div className="ml-2 pl-4 border-l-2 border-amber-500 bg-[#F8F7F4] rounded-r-lg p-3 text-sm space-y-1" data-testid={`review-reply-${id}`}>
          <div className="text-xs font-semibold text-amber-800 flex items-center gap-1"><CornerDownRight className="w-3.5 h-3.5" /> Balasan Vendor{r.reply.edited_at && <span className="font-normal text-slate-400">· diedit</span>}</div>
          <p className="text-slate-700">{r.reply.text}</p>
        </div>
      )}
      {isOwner && (
        <button onClick={() => { setText(r.reply?.text || ""); setEdit(true); }} data-testid={`reply-button-${id}`} className="text-xs font-semibold text-amber-700 hover:underline">
          {r.reply ? "Edit balasan" : "Balas ulasan"}
        </button>
      )}
    </>
  );
};
