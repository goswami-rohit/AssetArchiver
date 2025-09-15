// src/pages/BottomNavBar.tsx
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, MessageCircle, MapPin, User } from "lucide-react";
import React from "react";

type Item = {
  key: string;           // route path
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isActive?: (path: string) => boolean; // optional custom matcher
};

const ITEMS: Item[] = [
  { key: "/",         label: "Home",    Icon: Home,           isActive: p => p === "/" },
  { key: "/ai",      label: "AI",      Icon: MessageCircle,  isActive: p => p.startsWith("/ai") },
  { key: "/journey", label: "Journey", Icon: MapPin,         isActive: p => p.startsWith("/journey") },
  { key: "/profile", label: "Profile", Icon: User,           isActive: p => p.startsWith("/profile") },
];

export default function BottomNavBar() {
  const [location, navigate] = useLocation();

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="mx-auto max-w-md flex items-center justify-around py-2 px-4">
        {ITEMS.map(({ key, label, Icon, isActive }) => {
          const active = isActive ? isActive(location) : location === key;
          return (
            <Button
              key={key}
              onClick={() => navigate(key)}
              variant={active ? "default" : "ghost"}
              className={`flex flex-col gap-1 rounded-2xl min-w-[64px] h-16 ${
                active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
