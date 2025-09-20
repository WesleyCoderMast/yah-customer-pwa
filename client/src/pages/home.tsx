import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import BottomNavigation from "@/components/bottom-navigation";
import QRScanner from "@/components/qr-scanner";
import { VITE_API_BASE_URL } from "@/lib/config";

export default function Home() {
  const { user } = useAuth();
  const [showQRScanner, setShowQRScanner] = useState(false);
  
  // Fetch customer data from database
  const { data: customerData, isLoading } = useQuery({
    queryKey: ['/api/customer/profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      const response = await fetch(`${VITE_API_BASE_URL}/api/customer/profile?customerId=${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch customer data');
      const result = await response.json();
      return result.customer;
    },
    enabled: !!user?.id,
  });

  // Use customer data if available, fallback to user data
  const displayName = customerData?.name || `${user?.firstName || 'Customer'}`.trim();
  const firstName = customerData?.name?.split(' ')[0] || user?.firstName || 'Customer';

  // Show loading state while fetching customer data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-muted animate-pulse rounded-full"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-muted animate-pulse rounded-full"></div>
              </div>
              <div>
                <div className="h-5 w-20 bg-muted animate-pulse rounded mb-1"></div>
                <div className="h-3 w-24 bg-muted animate-pulse rounded"></div>
              </div>
            </div>
          </div>
        </header>
        <main className="p-4">
          <div className="mb-6">
            <div className="h-8 w-40 bg-muted animate-pulse rounded mb-2"></div>
            <div className="h-5 w-32 bg-muted animate-pulse rounded"></div>
          </div>
        </main>
        <BottomNavigation currentPage="home" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-10 h-10 border-2 border-primary/20">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                  {firstName?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h1 className="font-bold text-primary">{firstName}</h1>
              <p className="text-xs text-muted-foreground">Online • Zone 5</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">us</span>
            <span className="text-sm font-semibold">EN</span>
            <i className="fas fa-chevron-down text-xs text-muted-foreground"></i>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Welcome Section */}
        <section className="p-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-primary mb-1">Book a Ride</h2>
            <p className="text-muted-foreground">Welcome, {firstName}</p>
          </div>
        </section>

        {/* Quick Stats Cards */}
        <section className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="driver-card p-4">
              <div className="flex items-center space-x-2 mb-2">
                <i className="fas fa-dollar-sign text-accent"></i>
                <span className="text-sm font-medium text-primary">Available Balance</span>
              </div>
              <div className="text-2xl font-bold text-accent">$0.00</div>
              <div className="text-xs text-muted-foreground">Ready to spend</div>
            </div>
            
            <div className="driver-card p-4">
              <div className="flex items-center space-x-2 mb-2">
                <i className="fas fa-history text-primary"></i>
                <span className="text-sm font-medium text-primary">Recent Rides</span>
              </div>
              <div className="text-2xl font-bold text-primary">0</div>
              <div className="text-xs text-muted-foreground">This week</div>
            </div>
          </div>

          {/* QR Scanner Button */}
          <div className="mb-6">
            <Button
              onClick={() => setShowQRScanner(true)}
              className="w-full bg-gradient-gold text-yah-darker font-semibold py-4 text-lg"
            >
              <i className="fas fa-qrcode mr-3 text-xl"></i>
              Scan Driver QR Code
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Scan a driver's QR code to book a ride instantly
            </p>
          </div>

        </section>

      </main>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
      />

      <BottomNavigation currentPage="home" />
    </div>
  );
}
