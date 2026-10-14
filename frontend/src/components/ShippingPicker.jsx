import { Truck, Warehouse } from "lucide-react";
import { CARGO_BASE_FEE, rupiah, SHIP_METHODS } from "@/lib/format";

export const groupBySeller = (items) => {
  const g = {};
  items.forEach((it) => { (g[it.listing.owner_id] ||= { seller: it.listing.owner_name, items: [] }).items.push(it); });
  return g;
};

export const cargoEstimate = (items) =>
  CARGO_BASE_FEE + items.filter((i) => i.listing.type === "material")
    .reduce((s, i) => s + (i.listing.shipping_fee_per_unit || 0) * i.qty, 0);

const ICONS = { pickup: Warehouse, vendor_cargo: Truck };

export const ShippingPicker = ({ sellerId, group, value, onChange }) => {
  const mats = group.items.filter((i) => i.listing.type === "material");
  const warehouse = mats[0]?.listing.warehouse_location;
  const cost = { pickup: 0, vendor_cargo: cargoEstimate(group.items) };
  return (
    <div className="space-y-2" data-testid={`shipping-picker-${sellerId}`}>
      <div className="text-sm font-medium">{group.seller} <span className="text-slate-500 font-normal">· {mats.length} material</span></div>
      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(SHIP_METHODS).map(([k, label]) => {
          const Icon = ICONS[k];
          return (
            <button type="button" key={k} data-testid={`shipping-option-${sellerId}-${k}`} onClick={() => onChange(k)}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${value === k ? "border-amber-600 bg-amber-50" : "border-slate-200 hover:border-slate-400"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="w-4 h-4" />{label}</div>
              <div className="text-xs text-slate-600 mt-1">
                {k === "pickup" ? `Gratis · ${warehouse || "Lokasi gudang dikonfirmasi vendor"}` : <>Estimasi ongkir <b className="font-mono">{rupiah(cost[k])}</b></>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
