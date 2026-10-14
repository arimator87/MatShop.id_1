import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";

export const NotificationBell = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], unread: 0 });
  const load = useCallback(() => api.get("/notifications").then(({ data }) => setData(data)).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const onOpen = (open) => {
    if (open && data.unread) api.post("/notifications/read-all").then(() => setData((d) => ({ ...d, unread: 0 })));
    if (!open) load();
  };

  return (
    <Popover onOpenChange={onOpen}>
      <PopoverTrigger data-testid="notification-bell" className="relative w-10 h-10 grid place-items-center rounded-full hover:bg-slate-100 transition-colors outline-none">
        <Bell className="w-5 h-5 text-slate-700" />
        {data.unread > 0 && (
          <span data-testid="notification-count" className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-mono grid place-items-center">{data.unread}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="notification-panel">
        <div className="px-4 py-3 border-b text-sm font-heading font-semibold">Notifikasi</div>
        <div className="max-h-96 overflow-auto divide-y">
          {data.items.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Belum ada notifikasi.</div>}
          {data.items.map((n) => (
            <button key={n.id} data-testid={`notification-item-${n.id}`} onClick={() => navigate(n.link)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${n.read ? "" : "bg-amber-50/60"}`}>
              <div className="text-sm font-semibold">{n.title}</div>
              <div className="text-xs text-slate-600 line-clamp-2">{n.body}</div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
