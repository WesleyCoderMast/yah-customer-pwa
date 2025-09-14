import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/bottom-navigation";
import RideCard from "@/components/ride-card";
import type { Ride } from "@shared/schema";

export default function Rides() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const { data: ridesData, isLoading } = useQuery({
    queryKey: ['/api/rides', user?.id],
    queryFn: () => fetch(`/api/rides?customerId=${user?.id}`).then(res => res.json()),
    enabled: !!user?.id,
  });

  const rides = (ridesData as any)?.rides || [];
  const activeRides = rides.filter((ride: Ride) => 
    ['pending', 'searching_driver', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'accepted', 'in_progress'].includes(ride.status)
  );
  const completedRides = rides.filter((ride: Ride) => 
    ['completed', 'cancelled'].includes(ride.status)
  );



  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-car text-primary text-2xl"></i>
              <div>
                <h1 className="text-xl font-bold text-primary">My Rides</h1>
                <p className="text-xs text-muted-foreground">Track your journeys</p>
              </div>
            </div>
            <Link href="/booking">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-newRide"
              >
                <i className="fas fa-plus mr-1"></i>
                New Ride
              </Button>
            </Link>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-secondary rounded-lg p-1">
            <button
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                activeTab === 'active'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-primary'
              }`}
              onClick={() => setActiveTab('active')}
              data-testid="tab-active"
            >
              <i className="fas fa-clock mr-2"></i>
              Active ({activeRides.length})
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                activeTab === 'completed'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-primary'
              }`}
              onClick={() => setActiveTab('completed')}
              data-testid="tab-completed"
            >
              <i className="fas fa-check-circle mr-2"></i>
              History ({completedRides.length})
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4">
        {activeTab === 'active' ? (
          <div className="space-y-4">
            {activeRides.length === 0 ? (
              <div className="driver-card p-8 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-car text-2xl text-muted-foreground"></i>
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">No Active Rides</h3>
                <p className="text-muted-foreground mb-6">Ready for your next adventure?</p>
                <Link href="/booking">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-bookFirst">
                    <i className="fas fa-plus mr-2"></i>
                    Book Your First Ride
                  </Button>
                </Link>
              </div>
            ) : (
              activeRides.map((ride: Ride) => (
                <RideCard key={ride.id} ride={ride} isActive={true} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {completedRides.length === 0 ? (
              <div className="driver-card p-8 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-history text-2xl text-muted-foreground"></i>
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">No Ride History</h3>
                <p className="text-muted-foreground mb-6">Your completed rides will appear here</p>
              </div>
            ) : (
              completedRides.map((ride: Ride) => (
                <RideCard key={ride.id} ride={ride} isActive={false} />
              ))
            )}
          </div>
        )}

        {/* Ride Statistics */}
        {completedRides.length > 0 && (
          <div className="driver-card mt-6">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold flex items-center text-primary">
                <i className="fas fa-chart-bar text-accent mr-2"></i>
                Your Journey Stats
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-accent">{completedRides.length}</div>
                  <div className="text-sm text-muted-foreground">Total Rides</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-accent">
                    {Math.round(completedRides.reduce((acc: number, ride: Ride) => acc + (ride.duration_minutes || 0), 0) / completedRides.length)}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg. Duration (min)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-accent">
                    ${completedRides.reduce((acc: number, ride: Ride) => acc + parseFloat(ride.total_fare || '0'), 0).toFixed(0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Spent</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNavigation currentPage="rides" />
    </div>
  );
}
