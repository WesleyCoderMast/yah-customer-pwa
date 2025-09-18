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
import { VITE_API_BASE_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";

export default function RideTracking() {
  const [match, params] = useRoute("/ride/:rideId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRating, setShowRating] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [refundQuote, setRefundQuote] = useState<{ amountCents: number; totalFare: number; ceoInvisible: number } | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [rating, setRating] = useState<1 | 2 | null>(null);
  const [ratingEmoji, setRatingEmoji] = useState("");
  const [showPayment, setShowPayment] = useState(false);

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
      await apiRequest('POST', `/api/rides/${params?.rideId}/rate`, ratingData);
      await apiRequest('POST', `/api/rides/${params?.rideId}/finish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rides', params?.rideId] });
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
      toast({ title: 'Ride Completed', description: 'Thanks for your feedback!' });
      setShowRating(false);
    },
    onError: (error: any) => {
      toast({ title: 'Unable to complete ride', description: error.message, variant: 'destructive' });
    },
  });

  const ride = (rideData as any)?.ride;
  const driver = (rideData as any)?.ride?.driver;

  // Generate Yah driver ID format
  const generateYahDriverId = (driverId: string, driverName?: string) => {
    // Extract numeric part from driver ID or generate a random number
    const numericPart = driverId.replace(/\D/g, '').slice(-4) || Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const displayName = driverName ? ` ${driverName}` : ' Driver';
    return `Yah-${numericPart}${displayName}`;
  };

  const getDriverPreferenceText = (preferenceId: number | null) => {
    switch (preferenceId) {
      case 1:
        return 'Female drivers only';
      case 2:
        return 'Male drivers only';
      case 3:
        return 'Deaf or hard-of-hearing drivers only';
      case 4:
        return 'Hearing drivers only';
      case 5:
        return 'Drivers comfortable with disabilities';
      case 6:
      default:
        return 'No preference';
    }
  };

  const getDriverPreferenceIcon = (preferenceId: number | null) => {
    switch (preferenceId) {
      case 1:
        return 'fa-venus'; // Female symbol
      case 2:
        return 'fa-mars'; // Male symbol
      case 3:
        return 'fa-hand-paper'; // Sign language
      case 4:
        return 'fa-ear-listen'; // Hearing
      case 5:
        return 'fa-wheelchair'; // Accessibility
      case 6:
      default:
        return 'fa-user-check'; // General/any driver
    }
  };

  // Do not auto-open rating; we open it when user taps Finish

  // Realtime: listen for server trigger notification via inserting into yah_chat_sessions for this ride
  useEffect(() => {
    if (!params?.rideId) return;

    // Subscribe to postgres insert on yah_chat_sessions filtered by ride
    const channel = supabase
      .channel(`chat_room_${params.rideId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'yah_chat_sessions', filter: `ride_id=eq.${params.rideId}` },
        (payload) => {
          try {
            toast({
              title: 'Chat ready',
              description: 'Your driver chat room is ready. Tap to open.',
            });
            // Refresh ride data
            queryClient.invalidateQueries({ queryKey: ['/api/rides', params.rideId] });
          } catch (e) {
            // no-op
          }
        }
      )
      .subscribe((status) => {
        // Optionally log status
        // console.log('Realtime channel status:', status)
      });

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [params?.rideId, queryClient, toast]);

  // Check for payment success when returning from payment
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const pspReference = urlParams.get('psp_reference');
    const resultCode = urlParams.get('result_code');

    if (paymentSuccess === 'true' && pspReference && resultCode) {
      // Payment was successful, update the ride status
      handlePaymentSuccess(pspReference, resultCode);
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Handle payment success
  const handlePaymentSuccess = async (pspReference: string, resultCode: string) => {
    try {
      // Call backend to update ride status and payment info
      const response = await fetch(`${VITE_API_BASE_URL}/api/rides/${params?.rideId}/payment-success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pspReference,
          resultCode,
          rideId: params?.rideId
        })
      });

      if (response.ok) {
        toast({
          title: "Payment Successful!",
          description: "Your payment has been processed successfully.",
        });
        
        // Refresh ride data to show updated status
        queryClient.invalidateQueries({ queryKey: ['/api/rides', params?.rideId] });
      } else {
        throw new Error('Failed to update ride status');
      }
    } catch (error: any) {
      console.error('Payment success handling error:', error);
      toast({
        title: "Payment Processed",
        description: "Your payment was successful, but there was an issue updating the ride status.",
        variant: "destructive",
      });
    }
  };


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
      
      // Generate Yah driver ID for payment description
      const yahDriverId = driver ? generateYahDriverId(driver.id, driver.name) : 'Yah-0000 Driver';
      
      // Create shorter reference (max 80 chars for Adyen)
      const shortRideId = ride.id.substring(0, 8); // First 8 chars of ride ID
      const reference = `R${shortRideId}`; // Format: R12345678 (9 chars)
      
      // Create payment link instead of session
      const resp = await fetch(`${VITE_API_BASE_URL}/api/payments/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantAccount: 'YOUR_MERCHANT_ACCOUNT', // This constant is removed, so it will cause a compile error.
          amount: { currency: 'USD', value: amountMinor },
          reference: reference,
          description: `Payment for ride with ${yahDriverId}`,
          shopperLocale: 'en_US',
          returnUrl: `${window.location.origin}/ride/${ride.id}?payment_success=true&psp_reference={pspReference}&result_code={resultCode}`, // Return to current ride tracking page with payment success params
          metadata: {
            shopperReference: (user as any)?.id,
            rideId: ride.id,
            driverId: driver?.id,
            yahDriverId: yahDriverId
          }
        })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Failed to create payment link');
      
      // Open payment link in new tab
      if (data.url) {
        // Try opening synchronously to avoid popup blockers
        const newWin = window.open('about:blank', '_blank');
        if (newWin && !newWin.closed) {
          newWin.opener = null;
          newWin.location.replace(data.url);
        } else {
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
          description: 'A secure payment page has been opened in a new tab. Complete your payment there.'
        });
      } else {
        throw new Error('No payment URL received');
      }
    } catch (e: any) {
      toast({ title: 'Unable to create payment link', description: e?.message || 'Unknown', variant: 'destructive' });
    }
  }

  if (isLoading || !rideData) {
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

  const canCancelRide = ['pending', 'searching_driver', 'driver_assigned', 'accepted'].includes(ride.status);

  const finishRide = async () => {
    try {
      await apiRequest('POST', `/api/rides/${params?.rideId}/finish`);
      toast({ title: 'Ride Finished', description: 'Thank you for riding with us.' });
      queryClient.invalidateQueries({ queryKey: ['/api/rides', params?.rideId] });
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
    } catch (e: any) {
      toast({ title: 'Unable to finish ride', description: e?.message || 'Unknown error', variant: 'destructive' });
    }
  };

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
            <CardContent className="space-y-4">
              {/* Driver Profile */}
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-gold rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-yah-dark text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-foreground">{generateYahDriverId(driver.id, driver.name)}</h3>
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
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-2">
                {/* Primary Actions Row */}
                <div className="flex space-x-2">
                  {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                    <Button 
                      onClick={() => setLocation('/chat')} 
                      className="flex-1 bg-yah-gold hover:bg-yah-gold/90 text-yah-dark font-semibold"
                      data-testid="button-chat-driver"
                    >
                      <i className="fas fa-comments mr-2"></i>
                      Chat
                    </Button>
                  )}
                  
                  {/* Pay button hidden for completed rides per new rule */}
                </div>

                {/* Ride Control Actions - Show when ride is accepted */}
                {ride.status === 'accepted' && (
                  <div className="flex space-x-2">
                    <Button 
                      onClick={finishRide}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                      data-testid="button-finish-ride"
                    >
                      <i className="fas fa-flag-checkered mr-2"></i>
                      Finish Ride
                    </Button>
                    <Button 
                      onClick={() => setShowCancel(true)}
                      variant="destructive"
                      className="flex-1 font-semibold"
                      data-testid="button-cancel-ride"
                    >
                      <i className="fas fa-ban mr-2"></i>
                      Cancel & Report
                    </Button>
                  </div>
                )}
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
            {ride.ride_scope && (
              <div className="flex justify-between">
                <span>Scope</span>
                <span className="font-medium text-blue-400">{ride.ride_scope}</span>
              </div>
            )}
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
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center flex-shrink-0">
                <i className={`fas ${getDriverPreferenceIcon(ride.person_preference_id)} mr-2 text-yah-gold`}></i>
                <span>Driver Preference</span>
              </div>
              <span className="font-medium text-right flex-1 min-w-0">
                {getDriverPreferenceText(ride.person_preference_id)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Pay button moved to driver details card */}
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
                  <div className="bg-muted/40 rounded p-3 text-sm">
                    {refundQuote ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Refund you’ll receive</span>
                        <span className="font-semibold text-yah-gold">${(refundQuote.amountCents / 100).toFixed(2)}</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-yah-gold/30 text-yah-gold"
                        onClick={async () => {
                          try {
                            const res = await apiRequest('GET', `/api/rides/${params?.rideId}/refund-quote`);
                            const json = await res.json();
                            setRefundQuote(json);
                          } catch {
                            setRefundQuote(null);
                          }
                        }}
                      >
                        Calculate Refund
                      </Button>
                    )}
                  </div>
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
                      Refund & Cancel
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCancel(false)}
                      className="flex-1 border-yah-gold/30 text-yah-gold"
                    >
                      Keep Ride (No Refund)
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
              <p className="text-gray-300">How was your ride with {driver ? generateYahDriverId(driver.id, driver.name) : 'your driver'}?</p>
              
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
                <div className="space-y-4 mt-4 mb-2">
                  <p className="text-sm text-gray-400">Add an emoji (optional)</p>
                  <div className="flex justify-center flex-wrap gap-4 overflow-x-auto max-w-full px-3 py-2">
                    {['😊', '😍', '👍', '🙏', '❤️', '😐', '😔', '👎'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setRatingEmoji(emoji)}
                        aria-pressed={ratingEmoji === emoji}
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all focus:outline-none ${
                          ratingEmoji === emoji
                            ? 'bg-yah-gold text-yah-darker scale-110 ring-2 ring-yah-gold/80'
                            : 'bg-yah-muted hover:bg-yah-gold/30 ring-1 ring-transparent'
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
