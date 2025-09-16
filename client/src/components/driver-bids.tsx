import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import PaymentForm from "./payment-form";
import { VITE_API_BASE_URL, VITE_ADYEN_MERCHANT_ACCOUNT } from "@/lib/config";

interface DriverBidsProps {
  rideId: string;
  rideStatus: string;
  onDriverSelected?: () => void;
}

interface DriverBid {
  id: string;
  estimated_fare_min: string | number;
  estimated_fare_max: string | number;
  estimated_duration: number;
  notes?: string;
  status: string;
  created_at: string;
  drivers: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    vehicleType: string;
    profilePhoto?: string;
    rating?: string;
  };
}

export default function DriverBids({ rideId, rideStatus, onDriverSelected }: DriverBidsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSelecting, setIsSelecting] = useState(false);

  // Generate Yah driver ID format
  const generateYahDriverId = (driverId: string, driverName?: string) => {
    // Extract numeric part from driver ID or generate a random number
    const numericPart = driverId.replace(/\D/g, '').slice(-4) || Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const displayName = driverName ? ` ${driverName}` : ' Driver';
    return `Yah-${numericPart}${displayName}`;
  };

  // Fetch driver bids for this ride
  const { data: bidsData, isLoading } = useQuery({
    queryKey: ['/api/rides', rideId, 'requests'],
    queryFn: () => fetch(`${VITE_API_BASE_URL}/api/rides/${rideId}/requests`).then(res => res.json()),
    enabled: !!rideId && (rideStatus === 'pending' || rideStatus === 'searching_driver'),
    refetchInterval: 5000, // Poll for new bids every 5 seconds
  });

  const [selectedDriverData, setSelectedDriverData] = useState<{requestId: string, driverInfo: any} | null>(null);

  const handleDriverSelection = (requestId: string, driverInfo: any) => {
    setSelectedDriverData({ requestId, driverInfo });
  };

  const bids = (bidsData as any)?.requests || [];

  // Handle payment success
  const handlePaymentSuccess = () => {
    setSelectedDriverData(null);
    onDriverSelected?.();
  };

  // Handle payment cancel
  const handlePaymentCancel = () => {
    setSelectedDriverData(null);
    setIsSelecting(false);
  };

  // Create payment link for driver selection
  const handleCreatePaymentLink = async (bid: DriverBid) => {
    try {
      setIsSelecting(true);
      
      // Calculate fare amount
      const fareAmount = parseFloat(String(bid.estimated_fare_max ?? '0'));
      const amountMinor = Math.round(fareAmount * 100); // Convert to minor units
      
      // Generate Yah driver ID
      const yahDriverId = bid.drivers?.id ? generateYahDriverId(bid.drivers.id, bid.drivers.name) : 'Yah-0000 Driver';
      
      // Create shorter reference (max 80 chars for Adyen)
      const shortRideId = rideId.substring(0, 8); // First 8 chars of ride ID
      const shortBidId = bid.id.substring(0, 8); // First 8 chars of bid ID
      const reference = `R${shortRideId}B${shortBidId}`; // Format: R12345678B87654321 (18 chars)
      
      // Create payment link
      const resp = await fetch(`${VITE_API_BASE_URL}/api/payments/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantAccount: VITE_ADYEN_MERCHANT_ACCOUNT,
          amount: { currency: 'USD', value: amountMinor },
          reference: reference,
          description: `Payment for ride with ${yahDriverId}`,
          shopperLocale: 'en_US',
          returnUrl: `${window.location.origin}/ride/${rideId}?payment_success=true&psp_reference={pspReference}&result_code={resultCode}`, // Return to ride tracking page with payment success params
          metadata: {
            rideId: rideId,
            bidId: bid.id,
            driverId: bid.drivers?.id,
            yahDriverId: yahDriverId
          }
        })
      });
      
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Failed to create payment link');
      
      // Open payment link avoiding popup blockers
      if (data.url) {
        // Attempt to use a window opened in the click handler context
        const newWin = window.open('about:blank', '_blank');
        if (newWin && !newWin.closed) {
          newWin.opener = null;
          newWin.location.replace(data.url);
        } else {
          // Fallback to anchor click
          const a = document.createElement('a');
          a.href = data.url;
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        toast({
          title: 'Payment Link Created',
          description: 'A secure payment page has been opened. Complete your payment to confirm this driver.'
        });
        // Call the driver selected callback to refresh the ride data
        onDriverSelected?.();
      } else {
        throw new Error('No payment URL received');
      }
    } catch (e: any) {
      toast({ 
        title: 'Unable to create payment link', 
        description: e?.message || 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setIsSelecting(false);
    }
  };

  // If payment form is shown, render it instead of driver list
  if (selectedDriverData) {
    const fareAmount = parseFloat(selectedDriverData.driverInfo.estimated_fare_max || '25.00');
    return (
      <PaymentForm
        rideId={rideId}
        requestId={selectedDriverData.requestId}
        driverInfo={selectedDriverData.driverInfo}
        amount={fareAmount}
        onPaymentSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
      />
    );
  }
  
  // Show all available driver bids for customer to choose from
  // Only hide if ride status is already "accepted" (customer has made their choice)
  
  // Don't show bidding interface if ride already has a driver selected
  if (rideStatus === 'accepted' || rideStatus === 'in_progress' || rideStatus === 'completed') {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="driver-card">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <i className="fas fa-users mr-2"></i>
            Loading Driver Bids...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3 p-3 bg-secondary rounded-lg animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded mb-2"></div>
                  <div className="h-3 w-16 bg-muted rounded"></div>
                </div>
                <div className="h-8 w-20 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bids.length === 0) {
    return (
      <Card className="driver-card">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <i className="fas fa-search mr-2"></i>
            Searching for Drivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-car text-2xl text-muted-foreground animate-pulse"></i>
            </div>
            <p className="text-muted-foreground">
              Waiting for drivers to bid on your ride...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This usually takes 1-3 minutes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="driver-card">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <i className="fas fa-users mr-2"></i>
          Available Drivers ({bids.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bids.map((bid: DriverBid) => (
            <div
              key={bid.id}
              className="p-5 bg-secondary rounded-xl border border-border hover:border-primary/50 transition-all"
            >
              {/* Mobile-first stacked layout */}
              <div className="space-y-3 mb-4">
                {/* Driver header with name and price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-12 h-12 border-2 border-primary/20">
                      <AvatarImage src={bid.drivers?.profilePhoto} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                        {bid.drivers?.id ? generateYahDriverId(bid.drivers.id, bid.drivers.name).substring(0, 2).toUpperCase() : 'DR'}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-bold text-primary text-lg">
                      {bid.drivers?.id ? generateYahDriverId(bid.drivers.id, bid.drivers.name) : 'Driver Available'}
                    </h3>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 text-xl font-bold px-3 py-1">
                    {(() => {
                      const num = parseFloat(String(bid.estimated_fare_max ?? ''));
                      return isNaN(num) ? '$—' : `$${num.toFixed(2)}`;
                    })()}
                  </Badge>
                </div>
                
                {/* Driver details in mobile-friendly rows */}
                <div className="space-y-2 pl-15">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center">
                      <i className="fas fa-star text-yellow-400 mr-1"></i>
                      {bid.drivers?.rating ? Number(bid.drivers.rating).toFixed(1) : '4.8'} rating
                    </span>
                    {bid.estimated_duration ? (
                      <span className="flex items-center">
                        <i className="fas fa-clock text-blue-400 mr-1"></i>
                        {bid.estimated_duration} min arrival
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <i className="fas fa-car text-gray-400 mr-2"></i>
                    {bid.drivers?.vehicleType || 'Vehicle Information Unavailable'}
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    <i className="fas fa-check-circle text-green-400 mr-2"></i>
                    Available for pickup
                  </div>
                </div>
              </div>
              
              {/* Payment Link Button */}
              <Button
                onClick={() => handleCreatePaymentLink(bid)}
                disabled={isSelecting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-lg font-semibold"
                data-testid={`button-select-driver-${bid.id}`}
              >
                <i className="fas fa-credit-card mr-2"></i>
                {isSelecting ? 'Creating Payment...' : 'Select & Pay'}
              </Button>
              
              {/* Commented out old Select & Pay button functionality */}
              {/* 
              <Button
                onClick={() => handleDriverSelection(bid.id, bid)}
                disabled={isSelecting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-lg font-semibold"
                data-testid={`button-select-driver-${bid.id}`}
              >
                <i className="fas fa-credit-card mr-2"></i>
                Select & Pay
              </Button>
              */}
              
                    {bid.notes && (
                      <div className="mt-3 p-3 bg-primary/10 rounded-md">
                        <p className="text-sm text-muted-foreground">
                          <i className="fas fa-comment mr-2"></i>
                          "{bid.notes}"
                        </p>
                      </div>
                    )}
              
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <i className="fas fa-info-circle mr-2 text-primary"></i>
            Select your preferred driver based on price, rating, and arrival time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}