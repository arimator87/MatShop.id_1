import { useState } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { emptyTax, TaxFields, taxValid } from "@/components/TaxFields";

export const TaxSection = ({ o, onSaved, editable }) => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(o.tax_info || user.tax_profile || emptyTax);

  const save = async () => {
    try {
      const { data } = await api.put(`/orders/${o.order_id}/tax-info`, t);
      toast.success("Data NPWP disimpan ke invoice");
      setEditing(false);
      onSaved(data);
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3" data-testid="order-tax-section">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading font-semibold flex items-center gap-2"><Receipt className="w-5 h-5 text-amber-600" /> Faktur Pajak B2B (NPWP)</h3>
        {editable && !editing && (
          <button data-testid="order-tax-edit" onClick={() => setEditing(true)} className="text-sm font-semibold text-amber-700 hover:underline">
            {o.tax_info ? "Ubah" : "Tambah NPWP"}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <TaxFields value={t} onChange={setT} prefix="order-tax" />
          <button data-testid="order-tax-save" onClick={save} disabled={!taxValid(t)}
            className="h-10 px-5 rounded-full bg-[#1E242B] text-white text-sm font-semibold disabled:opacity-40">Simpan ke Invoice</button>
        </>
      ) : o.tax_info ? (
        <div className="text-sm" data-testid="order-tax-info">
          <div className="font-semibold">{o.tax_info.company_name}</div>
          <div className="font-mono text-slate-700">NPWP {o.tax_info.npwp}</div>
          <div className="text-slate-600">{o.tax_info.company_address}</div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Belum ada data NPWP. Tambahkan agar invoice PDF memuat identitas pajak, DPP, dan PPN.</p>
      )}
    </div>
  );
};
