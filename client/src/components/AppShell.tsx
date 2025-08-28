// src/components/AppShell.tsx
import { useLocation } from "wouter";
import { PropsWithChildren } from "react";
import { Button } from "@/components/ui/button";
import { Home, MessageCircle, MapPin, User } from "lucide-react";

function BottomNav({ current, go }: { current: string; go: (p: string) => void }) {
  const items = [
    { key: "/crm",         icon: Home,           label: "Home" },
    { key: "/crm/ai",      icon: MessageCircle,  label: "AIChat" },
    { key: "/crm/journey", icon: MapPin,         label: "Journey" },
    { key: "/crm/profile", icon: User,           label: "Profile" },
  ] as const;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t shadow-lg">
      <div className="mx-auto max-w-md flex items-center justify-around py-2 px-4">
        {items.map(it => (
          <Button
            key={it.key}
            onClick={() => go(it.key)}
            variant={current === it.key ? "default" : "ghost"}
            className={`flex flex-col gap-1 rounded-2xl min-w-[64px] h-16 ${
              current === it.key ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
            }`}
          >
            <it.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{it.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function AppShell({ children }: PropsWithChildren) {
  const [location, setLocation] = useLocation();

  return (
    <div className="h-full max-w-md mx-auto flex flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto pb-[88px]">{children}</main>
      <BottomNav current={location} go={setLocation} />
    </div>
  );
}