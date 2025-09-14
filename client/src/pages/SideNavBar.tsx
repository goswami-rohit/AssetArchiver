import React from 'react';
import { useLocation } from 'wouter'; // Changed from react-router-dom to wouter
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { useAppStore } from '../components/ReusableUI';
import { 
  LayoutDashboard, FilePlus, File, ShoppingCart, PlusCircle, Building, MapPin, 
  ClipboardList, LineChart, CalendarX, Users, Building2, BarChart3, Settings, 
  Key, Book, LogOut 
} from "lucide-react";

// --- Type Definitions ---
type TabType = 
  | "dashboard" | "dvr-form" | "tvr-form" | "sales-order-form" | "pjp-form" 
  | "dealer-form" | "site-form" | "daily-tasks-form" | "competition-form" | "leave-form"
  | "employees" | "office-management" | "attendance-reports"
  | "bot-config" | "api-keys" | "api-docs";

// The SidebarProps interface is no longer needed.

// --- Navigation Sections ---
const navSections = [
    // ... (no changes in this array)
  {
    title: "Main",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "Create",
    items: [
      { id: "dvr-form", label: "Create DVR", icon: FilePlus },
      { id: "tvr-form", label: "Create TVR", icon: File },
      { id: "sales-order-form", label: "Sales Order", icon: ShoppingCart },
      { id: "pjp-form", label: "Add PJP", icon: PlusCircle },
      { id: "dealer-form", label: "Add Dealer", icon: Building },
      { id: "site-form", label: "Add Site", icon: MapPin },
      { id: "daily-tasks-form", label: "Daily Tasks", icon: ClipboardList },
      { id: "competition-form", label: "Competition Form", icon: LineChart },
      { id: "leave-form", label: "Apply For Leave", icon: CalendarX },
    ]
  },
];

// --- Main Sidebar Component ---
export default function SideNavbar() { // Removed props
  const [location, navigate] = useLocation();
  const { user, setUser } = useAppStore();
  
  // Determine the active tab from the URL path
  const activeTab = location.substring(1) || 'dashboard'; // Default to dashboard if path is "/"

  const handleLogout = () => {
    toast("Are you sure you want to log out?", {
      action: {
        label: "Log Out",
        onClick: () => {
          localStorage.clear();
          setUser(null);
          navigate('/login');
          toast.success("You have been logged out.");
        }
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      }
    });
  };

  const initials = `${user?.firstName?.[0] || 'A'}${user?.lastName?.[0] || 'D'}`;

  return (
    <aside className="w-64 bg-white shadow-lg border-r border-slate-200 h-screen flex flex-col fixed">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <img 
            src="/BEST_CEMENT_LOGO.webp" 
            alt="Best Cement Logo" 
            className="w-12 h-12 rounded-xl shadow-lg object-cover"
          />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Best Cement</h1>
            <p className="text-xs text-slate-500">Employee Management</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <h2 className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{section.title}</h2>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    // The button now handles navigation directly
                    onClick={() => navigate(`/${item.id}`)}
                    className={cn(
                      "w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {/* User Profile & Logout */}
      <div className="p-4 border-t border-slate-200 mt-auto">
        <div className="flex items-center space-x-3 p-3 bg-slate-100 rounded-lg">
          <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold">
            <span>{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{`${user?.firstName || 'Admin'} ${user?.lastName || 'User'}`}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@bestcement.com'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}