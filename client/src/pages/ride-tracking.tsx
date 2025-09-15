import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import DriverBids from "@/components/driver-bids";
import type { Ride } from "@shared/schema";
import { VITE_API_BASE_URL, VITE_ADYEN_CLIENT_KEY, VITE_ADYEN_ENVIRONMENT } from "@/lib/config";

export default function RideTracking() {
  const [match, params] = useRoute("/ride/:rideId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRating, setShowRating] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [rating, setRating] = useState<1 | 2 | null>(null);
  const [ratingEmoji, setRatingEmoji] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [dropInMounted, setDropInMounted] = useState(false);
  const [adyenSession, setAdyenSession] = useState<any>(null);

  const { data: rideData, isLoading } = useQuery({
    queryKey: ['/api/rides', params?.rideId || ''],
    enabled: !!params?.rideId,
    refetchInterval: 20000, // Poll every 20 seconds for updates
  });

  const cancelRideMutation = useMutation({
    mutationFn: async (reason: string) => {
      return await apiRequest('POST', `/api/rides/${params?.rideId}/cancel`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
      toast({
        title: "Ride Cancelled",
        description: "Your ride has been cancelled successfully",
      });
      setShowCancel(false);
      setTimeout(() => setLocation('/rides'), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rateRideMutation = useMutation({
    mutationFn: async (ratingData: { rating: number; emoji?: string }) => {
      return await apiRequest('POST', `/api/rides/${params?.rideId}/rate`, ratingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
      toast({
        title: "Thank You!",
        description: "Your rating has been submitted",
      });
      setShowRating(false);
      setTimeout(() => setLocation('/rides'), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Rating Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const ride = (rideData as any)?.ride;
  const driver = (rideData as any)?.ride?.driver;

  useEffect(() => {
    if (ride?.status === 'completed' && !ride.customerRating) {
      setShowRating(true);
    }
  }, [ride]);

  async function ensureAdyenScript(): Promise<void> {
    if (document.getElementById('adyen-dropin-js')) return;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.id = 'adyen-dropin-js';
      s.src = "https://checkoutshopper-live.adyen.com/checkoutshopper/sdk/5.57.0/adyen.js".replace('live', VITE_ADYEN_ENVIRONMENT === 'live' ? 'live' : 'test');
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Adyen Drop-in'));
      document.head.appendChild(s);
    });
    if (!document.getElementById('adyen-dropin-css')) {
      const l = document.createElement('link');
      l.id = 'adyen-dropin-css';
      l.rel = 'stylesheet';
      l.href = "https://checkoutshopper-live.adyen.com/checkoutshopper/sdk/5.57.0/adyen.css".replace('live', VITE_ADYEN_ENVIRONMENT === 'live' ? 'live' : 'test');
      document.head.appendChild(l);
    }
  }

  async function onPay() {
    try {
      if (!ride) return;
      const rawFare = (ride.total_fare ?? '0') as any;
      const numFare = typeof rawFare === 'number' ? rawFare : parseFloat(String(rawFare));
      let amountMinor: number;
      if (!Number.isFinite(numFare)) {
        amountMinor = 0;
      } else if (String(rawFare).includes('.')) {
        // Value appears to be in major units (e.g., 12.34 dollars)
        amountMinor = Math.round(numFare * 100);
      } else if (numFare < 1 && numFare > 0) {
        // Fractional (edge case)
        amountMinor = Math.round(numFare * 100);
      } else {
        // Assume already minor units
        amountMinor = Math.round(numFare);
      }
      const resp = await fetch(`${VITE_API_BASE_URL}/api/payments/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: { currency: 'USD', value: amountMinor },
          reference: `ride-${ride.id}`,
          returnUrl: window.location.origin + `/rides`,
          shopperReference: (user as any)?.id
        })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Failed to create session');
      setAdyenSession(data.session);
      setShowPayment(true);
    } catch (e: any) {
      toast({ title: 'Unable to start payment', description: e?.message || 'Unknown', variant: 'destructive' });
    }
  }

  useEffect(() => {
    async function mountDropin() {
      if (!showPayment || !adyenSession) return;
      await ensureAdyenScript();
      // @ts-ignore
      const checkout = await new (window as any).AdyenCheckout({
        clientKey: VITE_ADYEN_CLIENT_KEY,
        environment: VITE_ADYEN_ENVIRONMENT,
        session: adyenSession,
        analytics: { enabled: false },
        onPaymentCompleted: () => {
          setShowPayment(false);
          setAdyenSession(null);
          setDropInMounted(false);
          queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
          toast({ title: 'Payment successful' });
        },
        onError: (err: any) => {
          console.error(err);
          toast({ title: 'Payment error', description: err?.message || 'Unknown', variant: 'destructive' });
        }
      });
      const el = document.getElementById('dropin-container');
      if (el) {
        // Clear previous content before re-mounting
        el.innerHTML = '';
        // @ts-ignore
        checkout.create('dropin').mount(el);
        setDropInMounted(true);
      }
    }
    mountDropin();
  }, [showPayment, adyenSession]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <i className="fas fa-car text-primary-foreground text-2xl"></i>
          </div>
          <p className="text-primary font-semibold">Loading ride details...</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="border max-w-md">
          <CardContent className="p-8 text-center">
            <i className="fas fa-exclamation-triangle text-red-400 text-4xl mb-4"></i>
            <h2 className="text-xl font-bold mb-2">Ride Not Found</h2>
            <p className="text-muted-foreground mb-6">The ride you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => setLocation('/rides')} className="bg-primary text-primary-foreground">
              View All Rides
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'searching_driver': return 'fa-search';
      case 'driver_assigned': return 'fa-user-check';
      case 'driver_arriving': return 'fa-route';
      case 'driver_arrived': return 'fa-hand-paper';
      case 'in_progress': return 'fa-car';
      case 'completed': return 'fa-check-circle';
      case 'cancelled': return 'fa-times-circle';
      default: return 'fa-clock';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      case 'in_progress': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-yah-gold/20 text-yah-gold';
    }
  };

  const canCancelRide = ['pending', 'searching_driver', 'driver_assigned'].includes(ride.status);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setLocation('/rides')}
            className="w-10 h-10 bg-muted/50 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
            data-testid="button-back"
          >
            <i className="fas fa-arrow-left text-primary"></i>
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Ride Tracking</h1>
            <p className="text-xs text-muted-foreground">Track your journey</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 pb-24">
        {/* Ride Status */}
        <Card className="glass border-yah-gold/20">
          <CardContent className="p-5">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-gradient-gold rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <i className={`fas ${getStatusIcon(ride.status)} text-yah-dark text-xl`}></i>
              </div>
              <Badge className={`${getStatusColor(ride.status)} px-3 py-1.5 text-xs font-semibold`}>
                {ride.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <p className="text-gray-300 mt-2 text-sm px-2">
                {ride.status === 'searching_driver' && "We're finding you a driver..."}
                {ride.status === 'driver_assigned' && "Driver assigned! They're on their way."}
                {ride.status === 'driver_arriving' && "Your driver is arriving soon."}
                {ride.status === 'driver_arrived' && "Your driver has arrived!"}
                {ride.status === 'in_progress' && "Enjoy your ride!"}
                {ride.status === 'completed' && "Hope you enjoyed your ride!"}
                {ride.status === 'cancelled' && "This ride was cancelled."}
              </p>
            </div>

            {/* Trip Details */}
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-4 h-4 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-400 text-base mb-1">Pickup</p>
                  <p className="text-gray-300 text-sm leading-5 break-words">{ride.pickup}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-4 h-4 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-400 text-base mb-1">Drop-off</p>
                  <p className="text-gray-300 text-sm leading-5 break-words">{ride.dropoff}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Bidding Section - Show when waiting for driver selection */}
        {(ride.status === 'pending' || ride.status === 'searching_driver') && (
          <DriverBids 
            rideId={ride.id} 
            rideStatus={ride.status} 
            onDriverSelected={() => {
              // Refresh the ride data when a driver is selected
              queryClient.invalidateQueries({ queryKey: ['/api/rides', params?.rideId] });
            }} 
          />
        )}

        {/* Driver Information - Show when driver is assigned */}
        {(ride.status === 'accepted' || ride.status === 'driver_assigned' || ride.status === 'driver_arriving' || ride.status === 'driver_arrived' || ride.status === 'in_progress' || ride.status === 'completed') && driver && (
          <Card className="glass border-yah-gold/20">
            <CardHeader>
              <CardTitle className="flex items-center text-yah-gold">
                <i className="fas fa-user-tie mr-2"></i>
                Your Driver
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-gold rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-yah-dark text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-foreground">{driver.name || 'Driver'}</h3>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <i className="fas fa-star text-yah-gold mr-1"></i>
                      <span>New</span>
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-car mr-1"></i>
                      <span>{driver.vehicle_type || 'Vehicle info not available'}</span>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => setLocation('/chat')} 
                  className="bg-yah-gold hover:bg-yah-gold/90 text-yah-dark font-semibold px-4 py-2"
                  data-testid="button-chat-driver"
                >
                  <i className="fas fa-comments mr-2"></i>
                  Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ride Details */}
        <Card className="glass border-yah-gold/20">
          <CardHeader>
            <CardTitle className="flex items-center text-yah-gold">
              <i className="fas fa-info-circle mr-2"></i>
              Ride Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Ride Type</span>
              <span className="font-medium">{ride.ride_type}</span>
            </div>
            <div className="flex justify-between">
              <span>Passengers</span>
              <span>{ride.rider_count}</span>
            </div>
            {ride.pet_count > 0 && (
              <div className="flex justify-between">
                <span>Pets</span>
                <span>{ride.pet_count}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total Fare</span>
              <span className="font-bold text-yah-gold">${parseFloat(ride.total_fare || '0').toFixed(2)}</span>
            </div>
            {ride.duration_minutes && (
              <div className="flex justify-between">
                <span>Estimated Duration</span>
                <span>{ride.duration_minutes} minutes</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {(parseFloat(ride.total_fare || '0') > 0) && (
            <Dialog open={showPayment} onOpenChange={(open) => { setShowPayment(open); if (!open) { setDropInMounted(false); setAdyenSession(null); } }}>
              <div className="space-y-3">
                <Button 
                  onClick={onPay}
                  className="w-full bg-gradient-gold text-yah-darker font-semibold"
                  data-testid="button-pay"
                >
                  <i className="fas fa-credit-card mr-2"></i>
                  Pay ${parseFloat(ride.total_fare || '0').toFixed(2)}
                </Button>
              </div>
              <DialogContent className="bg-yah-darker border-yah-gold/20">
                <DialogHeader>
                  <DialogTitle className="text-yah-gold">Complete Payment</DialogTitle>
                </DialogHeader>
                <div id="dropin-container" className="min-h-[280px]" />
              </DialogContent>
            </Dialog>
          )}
          {canCancelRide && (
            <Dialog open={showCancel} onOpenChange={setShowCancel}>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  data-testid="button-cancelRide"
                >
                  <i className="fas fa-times mr-2"></i>
                  Cancel Ride
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-yah-darker border-yah-gold/20">
                <DialogHeader>
                  <DialogTitle className="text-yah-gold">Cancel Ride</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-gray-300">Why are you cancelling this ride?</p>
                  <Textarea
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Optional: Tell us why you're cancelling..."
                    className="bg-yah-muted border-yah-gold/30"
                    data-testid="textarea-cancellationReason"
                  />
                  <div className="flex space-x-3">
                    <Button
                      variant="destructive"
                      onClick={() => cancelRideMutation.mutate(cancellationReason)}
                      disabled={cancelRideMutation.isPending}
                      className="flex-1"
                      data-testid="button-confirmCancel"
                    >
                      {cancelRideMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                      ) : (
                        <i className="fas fa-times mr-2"></i>
                      )}
                      Confirm Cancel
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCancel(false)}
                      className="flex-1 border-yah-gold/30 text-yah-gold"
                    >
                      Keep Ride
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Rating Dialog */}
        <Dialog open={showRating} onOpenChange={setShowRating}>
          <DialogContent className="bg-yah-darker border-yah-gold/20">
            <DialogHeader>
              <DialogTitle className="text-yah-gold text-center">Rate Your Ride</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 text-center">
              <p className="text-gray-300">How was your ride with {driver?.firstName}?</p>
              
              {/* Rating Buttons */}
              <div className="flex justify-center space-x-6">
                <button
                  onClick={() => setRating(2)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    rating === 2 ? 'bg-green-500 scale-110' : 'bg-yah-muted hover:bg-green-500/30'
                  }`}
                  data-testid="button-thumbsUp"
                >
                  <i className="fas fa-thumbs-up text-2xl"></i>
                </button>
                <button
                  onClick={() => setRating(1)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    rating === 1 ? 'bg-red-500 scale-110' : 'bg-yah-muted hover:bg-red-500/30'
                  }`}
                  data-testid="button-thumbsDown"
                >
                  <i className="fas fa-thumbs-down text-2xl"></i>
                </button>
              </div>

              {/* Emoji Selection */}
              {rating && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Add an emoji (optional)</p>
                  <div className="flex justify-center space-x-3">
                    {['😊', '😍', '👍', '🙏', '❤️', '😐', '😔', '👎'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setRatingEmoji(emoji)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all ${
                          ratingEmoji === emoji ? 'bg-yah-gold scale-110' : 'bg-yah-muted hover:bg-yah-gold/30'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {rating && (
                <Button
                  onClick={() => rateRideMutation.mutate({ rating, emoji: ratingEmoji })}
                  disabled={rateRideMutation.isPending}
                  className="bg-gradient-gold text-yah-darker font-semibold px-8"
                  data-testid="button-submitRating"
                >
                  {rateRideMutation.isPending ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fas fa-paper-plane mr-2"></i>
                  )}
                  Submit Rating
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
