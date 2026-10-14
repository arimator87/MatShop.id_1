import { Hammer, PenTool } from "lucide-react";

export const VENDOR_ROLE = {
  supplier_vendor: { label: "Workshop / Kontraktor", icon: Hammer },
  designer_creator: { label: "Desainer / Arsitek", icon: PenTool },
};
export const roleOf = (r) => VENDOR_ROLE[r] || VENDOR_ROLE.supplier_vendor;

export const WORK_TYPES = {
  kitchen_set: "Kitchen Set", wardrobe: "Wardrobe / Lemari", fit_out: "Fit-Out",
  interior: "Desain Interior", desain_3d: "Desain 3D & Render", arsitektur: "Arsitektur",
  furniture: "Furniture Custom", material: "Supply Material",
};
