import React, { useState } from 'react';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SideNavBar from '@/pages/SideNavBar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AppHeaderProps {
  title: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-gray-900/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Collapsible Menu using Shadcn's Sheet */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="left" 
              className="w-64 bg-gray-950 text-white border-r border-white/20 p-0"
            >
              <SheetHeader className="p-4 border-b border-white/20">
                <SheetTitle className="text-xl font-bold text-white">Menu</SheetTitle>
              </SheetHeader>
              <SideNavBar />
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-bold text-white">{title}</h1>
        </div>

        <div className="flex items-center">
          {/* Notification button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => console.log('Notifications clicked')}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            {/* <Bell className="h-5 w-5" /> */}
            <span className="sr-only">View notifications</span>
          </Button>
        </div>
      </div>
    </header>
  );
}