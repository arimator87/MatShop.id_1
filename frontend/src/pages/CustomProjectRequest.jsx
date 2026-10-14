import { useSearchParams } from "react-router-dom";
import { RequestForm } from "@/components/custom/RequestForm";

export default function CustomProjectRequest() {
  const [sp] = useSearchParams();
  const initial = { type: sp.get("type"), finishing: sp.get("finishing"), budget: sp.get("budget"), dims: { p: sp.get("p") || "", l: sp.get("l") || "", t: sp.get("t") || "", area: sp.get("area") || "" } };
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8" data-testid="custom-request-page">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">Custom Furniture & Fit-Out</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Ajukan Proyek Custom Furniture / Fit-Out</h1>
        <p className="text-slate-600 mt-2">Tim MatShop meninjau request Anda, lalu kontraktor terverifikasi mengirim proposal penawaran.</p>
      </div>
      <RequestForm initial={initial} />
    </div>
  );
}
