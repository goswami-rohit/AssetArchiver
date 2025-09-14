import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  title: string;
  onMenuClick: () => void; // Callback for when the menu icon is clicked
}

export default function AppHeader({ title, onMenuClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-gray-900/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Menu button to toggle a sidebar/drawer */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuClick} 
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
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
            <Bell className="h-5 w-5" />
            <span className="sr-only">View notifications</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
