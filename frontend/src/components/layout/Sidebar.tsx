import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Truck,
  FileText,
  Settings,
  LogOut,
  Beaker,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: ['admin', 'superadmin'] },
  { icon: Building2, label: "Companies", path: "/companies", roles: ['admin', 'employee', 'superadmin'] },
  { icon: ArrowDownToLine, label: "Inward", path: "/inward", roles: ['admin', 'employee', 'superadmin'] },
  { icon: ArrowUpFromLine, label: "Outward", path: "/outward", roles: ['admin', 'employee', 'superadmin'] },
  { icon: Truck, label: "Transporters", path: "/transporters", roles: ['admin', 'employee', 'superadmin'] },
  { icon: FileText, label: "Invoices", path: "/invoices", roles: ['admin', 'superadmin'] },
  { icon: Settings, label: "Settings", path: "/settings", roles: ['admin', 'superadmin'] },
];

interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export function Sidebar({ className, onItemClick }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const filteredMenuItems = menuItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border h-screen flex flex-col transition-all duration-300",
        collapsed ? "w-20" : "w-64",
        className
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1 shadow-sm">
          <img src={logo} alt="GHMC" className="w-full h-full object-contain" />
        </div>
        {!collapsed && (
          <div className="slide-in">
            <h1 className="font-bold text-foreground text-lg uppercase tracking-wider">GHMC</h1>
            <p className="text-[10px] text-muted-foreground uppercase">Gujarat Hazard Waste</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onItemClick}
              className={cn(
                "sidebar-item",
                isActive && "active"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-4 border-t border-sidebar-border hidden lg:flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>

      {/* User */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-foreground">
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.fullName || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
