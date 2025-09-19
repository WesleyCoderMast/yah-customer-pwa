import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import BottomNavigation from "@/components/bottom-navigation";
import { apiRequest } from "@/lib/queryClient";
import { VITE_API_BASE_URL } from "@/lib/config";
import type { Ride } from "@shared/schema";

export default function RideDetail() {
  const [match, params] = useRoute("/ride/:rideId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: rideData, isLoading, error } = useQuery({
    queryKey: ['/api/rides', params?.rideId || ''],
    queryFn: () => apiRequest('GET', `/api/rides/${params?.rideId}`).then(res => res.json()),
    enabled: !!params?.rideId,
  });

  const ride = (rideData as any)?.ride;
  const driver = (rideData as any)?.ride?.driver;

  const formatDate = (date: Date | string | null) => {
    if (!date) return { date: 'Unknown', time: 'Unknown' };
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return {
      date: dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'fa-check-circle';
      case 'cancelled':
        return 'fa-times-circle';
      default:
        return 'fa-clock';
    }
  };

  const generateYahDriverId = (driverId: string, driverName?: string) => {
    const numericPart = driverId.replace(/\D/g, '').slice(-4) || Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const displayName = driverName ? ` ${driverName}` : ' Driver';
    return `Yah-${numericPart}${displayName}`;
  };

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

  if (error || !ride) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-red-400 text-2xl"></i>
          </div>
          <p className="text-red-400 font-semibold mb-4">Ride not found</p>
          <Button onClick={() => setLocation('/rides')} variant="outline">
            Back to Rides
          </Button>
        </div>
      </div>
    );
  }

  const { date, time } = formatDate(ride.created_at);
  const completedDate = ride.completed_at ? formatDate(ride.completed_at) : null;
  const tipAmount = Number(ride.tip_amount || 0);
  const baseFare = Number(ride.total_fare || 0) - tipAmount;
  const totalPaymentAmount = Number(ride.total_fare || 0); // This is the total payment amount (base fare + tip)

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setLocation('/rides')}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
            <h1 className="text-xl font-bold text-yah-gold">Ride Details</h1>
            <p className="text-sm text-muted-foreground">{date}</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Status Card */}
        <Card className="glass border-yah-gold/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Badge className={`text-sm font-semibold px-3 py-1 ${getStatusColor(ride.status)}`}>
                  <i className={`fas ${getStatusIcon(ride.status)} mr-1.5`}></i>
                  {ride.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-sm text-yah-gold border-yah-gold/30 px-3 py-1">
                  {ride.ride_type}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yah-gold">
                  ${totalPaymentAmount.toFixed(2)}
                </p>
                <p className="text-sm text-gray-400">Total Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trip Details */}
        <Card className="glass border-yah-gold/20">
          <CardHeader>
            <CardTitle className="text-yah-gold flex items-center">
              <i className="fas fa-route mr-2"></i>
              Trip Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Route */}
            <div className="grid grid-cols-[20px_1fr] gap-x-4">
              <div className="flex flex-col items-center pt-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="w-0.5 flex-1 bg-gray-500 my-2"></div>
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
              <div className="flex flex-col justify-between min-h-[64px]">
                <div className="pb-2">
                  <p className="font-semibold text-base text-green-400 mb-1 leading-none">From</p>
                  <p className="text-base text-gray-300 leading-relaxed">{ride.pickup}</p>
                </div>
                <div className="pt-2">
                  <p className="font-semibold text-base text-red-400 mb-1 leading-none">To</p>
                  <p className="text-base text-gray-300 leading-relaxed">{ride.dropoff}</p>
                </div>
              </div>
            </div>

            <Separator className="bg-yah-gold/20" />

            {/* Trip Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <i className="fas fa-users mr-2 text-yah-gold"></i>
                  <span className="text-gray-300">{ride.rider_count || 1} passenger{(ride.rider_count || 1) > 1 ? 's' : ''}</span>
                </div>
                {(ride.pet_count || 0) > 0 && (
                  <div className="flex items-center text-sm">
                    <i className="fas fa-paw mr-2 text-yah-gold"></i>
                    <span className="text-gray-300">{ride.pet_count} pet{(ride.pet_count || 0) > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {ride.distance_miles && (
                  <div className="flex items-center text-sm">
                    <i className="fas fa-road mr-2 text-yah-gold"></i>
                    <span className="text-gray-300">{Number(ride.distance_miles).toFixed(1)} miles</span>
                  </div>
                )}
                {ride.duration_minutes && (
                  <div className="flex items-center text-sm">
                    <i className="fas fa-clock mr-2 text-yah-gold"></i>
                    <span className="text-gray-300">{Math.round(ride.duration_minutes)} min</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Information */}
        {driver && (
          <Card className="glass border-yah-gold/20">
            <CardHeader>
              <CardTitle className="text-yah-gold flex items-center">
                <i className="fas fa-user mr-2"></i>
                Driver Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-yah-gold/20 rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-yah-gold text-xl"></i>
                </div>
                <div>
                  <p className="font-semibold text-lg text-white">
                    {generateYahDriverId(driver.id, driver.name)}
                  </p>
                  <p className="text-sm text-gray-400">Your driver</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Breakdown */}
        <Card className="glass border-yah-gold/20">
          <CardHeader>
            <CardTitle className="text-yah-gold flex items-center">
              <i className="fas fa-receipt mr-2"></i>
              Payment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Ride Fare</span>
                <span className="font-semibold text-white">${baseFare.toFixed(2)}</span>
              </div>
              
              {tipAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Driver Tip</span>
                  <span className="font-semibold text-yah-gold">${tipAmount.toFixed(2)}</span>
                </div>
              )}
              
              <Separator className="bg-yah-gold/20" />
              
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-yah-gold">Total Payment</span>
                <span className="text-xl font-bold text-yah-gold">${totalPaymentAmount.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trip Timeline */}
        <Card className="glass border-yah-gold/20">
          <CardHeader>
            <CardTitle className="text-yah-gold flex items-center">
              <i className="fas fa-history mr-2"></i>
              Trip Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-semibold text-white">Ride Requested</p>
                  <p className="text-xs text-gray-400">{date} at {time}</p>
                </div>
              </div>
              
              {ride.accepted_at && (
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold text-white">Driver Accepted</p>
                    <p className="text-xs text-gray-400">{formatDate(ride.accepted_at).date} at {formatDate(ride.accepted_at).time}</p>
                  </div>
                </div>
              )}
              
              {ride.started_at && (
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold text-white">Trip Started</p>
                    <p className="text-xs text-gray-400">{formatDate(ride.started_at).date} at {formatDate(ride.started_at).time}</p>
                  </div>
                </div>
              )}
              
              {completedDate && (
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold text-white">Trip Completed</p>
                    <p className="text-xs text-gray-400">{completedDate.date} at {completedDate.time}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
}
