import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface BottomNavigationProps {
  currentPage: 'home' | 'rides' | 'history' | 'profile' | 'chat';
}

export default function BottomNavigation({ currentPage }: BottomNavigationProps) {
  const navItems = [
    {
      id: 'home',
      icon: 'fa-home',
      label: 'Home',
      href: '/',
    },
    {
      id: 'rides',
      icon: 'fa-car',
      label: 'Rides',
      href: '/rides',
    },
    {
      id: 'history',
      icon: 'fa-history',
      label: 'History',
      href: '/history',
    },
    {
      id: 'profile',
      icon: 'fa-user',
      label: 'Profile',
      href: '/profile',
    },
    {
      id: 'chat',
      icon: 'fa-robot',
      label: 'Message',
      href: '/chat',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          
          return (
            <Link key={item.id} href={item.href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center py-2 px-1 transition-colors cursor-pointer",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
                data-testid={`nav-${item.id}`}
              >
                <i className={`fas ${item.icon} text-lg mb-1`}></i>
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
