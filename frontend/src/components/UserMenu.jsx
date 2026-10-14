import { useNavigate } from "react-router-dom";
import { Check, LayoutDashboard, LogOut, Package } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { ROLE_META } from "@/lib/format";

export const UserMenu = () => {
  const { user, logout, switchRole } = useAuth();
  const navigate = useNavigate();
  const active = ROLE_META[user.active_role];

  const onSwitch = async (role) => {
    await switchRole(role);
    toast.success(`Beralih ke mode ${ROLE_META[role].short}`);
    navigate("/dashboard");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="user-menu-trigger"
        className="flex items-center gap-2 h-10 pl-1 pr-3 rounded-full border border-slate-200 hover:border-slate-400 transition-colors outline-none">
        {user.picture ? (
          <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-amber-600 text-white grid place-items-center text-sm font-bold">
            {user.name?.[0]}
          </span>
        )}
        <span className="hidden sm:block text-xs font-mono uppercase tracking-wider text-slate-600" data-testid="active-role-label">
          {active?.short || "Pilih Peran"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="font-semibold truncate">{user.name}</div>
          <div className="text-xs text-slate-500 font-normal truncate">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
          Ganti Peran / Dashboard
        </DropdownMenuLabel>
        {Object.entries(ROLE_META).map(([key, m]) => (
          <DropdownMenuItem key={key} data-testid={`role-switch-${key}`} onClick={() => onSwitch(key)} className="gap-2 cursor-pointer">
            <m.icon className="w-4 h-4" />
            <span className="flex-1">{m.label}</span>
            {user.active_role === key && <Check className="w-4 h-4 text-amber-600" />}
            {!user.enabled_roles.includes(key) && <span className="text-[10px] text-slate-400">aktifkan</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="menu-dashboard" onClick={() => navigate("/dashboard")} className="gap-2 cursor-pointer">
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="menu-orders" onClick={() => navigate("/pesanan")} className="gap-2 cursor-pointer">
          <Package className="w-4 h-4" /> Pesanan Saya
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="menu-logout" onClick={async () => { await logout(); navigate("/"); }} className="gap-2 cursor-pointer text-red-600">
          <LogOut className="w-4 h-4" /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
