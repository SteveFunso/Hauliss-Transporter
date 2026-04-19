import { useState } from 'react';
import {
  Search,
  Bell,
  Menu,
  Moon,
  Sun,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  pageTitle: string;
  user?: { fullName: string; email: string; role: string } | null;
  onLogout?: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar, pageTitle, user, onLogout }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(false);

  const notifications = [
    { id: 1, type: 'booking', message: 'New booking request from Swift Cargo', time: '5 min ago' },
    { id: 2, type: 'driver', message: 'Driver Ibrahim Musa completed trip #BKG001', time: '15 min ago' },
    { id: 3, type: 'payment', message: 'Payment of ₦45,000 received', time: '1 hour ago' }
  ];

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  const displayName = user?.fullName || 'Admin User';

  return (
    <header className={cn(
      'fixed top-0 right-0 z-40 h-20 bg-background/80 backdrop-blur-xl border-b border-border transition-all duration-300',
      sidebarOpen ? 'left-[280px]' : 'left-[80px]'
    )}>
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div>
            <h1 className="font-display font-semibold text-xl text-foreground">
              {pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {user?.fullName?.split(' ')[0] || 'Admin'}
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search anything..."
              className="pl-9 w-64 bg-muted/50 border-0"
            />
          </div>

          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="text-muted-foreground"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                <Bell className="w-5 h-5" />
                <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs bg-[#F97316] text-white">
                  {notifications.length}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-4 border-b border-border">
                <p className="font-semibold">Notifications</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map((notif) => (
                  <DropdownMenuItem key={notif.id} className="flex flex-col items-start p-3 cursor-pointer">
                    <p className="text-sm">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notif.time}</p>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-br from-[#F97316] to-[#111111] text-white text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline font-medium">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email || 'admin@hauliss.ng'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
