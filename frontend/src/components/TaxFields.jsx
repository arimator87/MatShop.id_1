const inputCls = "w-full h-10 px-3 rounded-lg border border-slate-300 bg-white outline-none focus:border-amber-600 text-sm";

export const emptyTax = { company_name: "", npwp: "", company_address: "" };

export const npwpDigits = (v) => (v || "").replace(/\D/g, "");
export const taxValid = (t) => t.company_name.trim().length >= 2 && [15, 16].includes(npwpDigits(t.npwp).length) && t.company_address.trim().length >= 5;

export const TaxFields = ({ value, onChange, prefix = "tax" }) => {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const n = npwpDigits(value.npwp).length;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="space-y-1"><span className="text-xs font-medium text-slate-600">Nama perusahaan (sesuai NPWP)</span>
        <input className={inputCls} value={value.company_name} onChange={set("company_name")} data-testid={`${prefix}-company-input`} placeholder="PT / CV ..." /></label>
      <label className="space-y-1"><span className="text-xs font-medium text-slate-600">NPWP (15/16 digit)</span>
        <input className={inputCls} value={value.npwp} onChange={set("npwp")} data-testid={`${prefix}-npwp-input`} placeholder="01.234.567.8-901.000" />
        {value.npwp && ![15, 16].includes(n) && <span className="text-[11px] text-red-600" data-testid={`${prefix}-npwp-error`}>{n} digit — harus 15 atau 16 digit</span>}</label>
      <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium text-slate-600">Alamat sesuai NPWP</span>
        <input className={inputCls} value={value.company_address} onChange={set("company_address")} data-testid={`${prefix}-address-input`} /></label>
    </div>
  );
};
