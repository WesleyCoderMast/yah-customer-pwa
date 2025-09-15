import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import BottomNavigation from "@/components/bottom-navigation";
import { Link } from "wouter";

interface Ride {
  id: string;
  pickup: string;
  dropoff: string;
  ride_type: string;
  status: 'completed' | 'cancelled' | 'in_progress' | string;
  total_fare?: number | string | null;
  created_at: string;
  completed_at?: string | null;
}

export default function History() {
  const { user } = useAuth();

  const { data: rides, isLoading } = useQuery<Ride[]>({
    queryKey: ['/api/rides/history', user?.id],
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Link href="/">
              <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <i className="fas fa-arrow-left text-primary"></i>
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-primary">My Rides</h1>
              <p className="text-sm text-muted-foreground">Track your journeys</p>
            </div>
          </div>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
            <i className="fas fa-plus mr-2"></i>
            New Ride
          </button>
        </div>
      </header>

      <main className="p-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="driver-card p-4">
            <div className="flex items-center space-x-2 mb-2">
              <i className="fas fa-check-circle text-accent"></i>
              <span className="text-sm font-medium text-primary">Completed</span>
            </div>
            <div className="text-2xl font-bold text-primary">
              {rides?.filter(ride => ride.status === 'completed').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Total rides</div>
          </div>
          
          <div className="driver-card p-4">
            <div className="flex items-center space-x-2 mb-2">
              <i className="fas fa-dollar-sign text-accent"></i>
              <span className="text-sm font-medium text-primary">Total Spent</span>
            </div>
            <div className="text-2xl font-bold text-accent">
              ${(
                rides?.reduce((sum, ride) => {
                  const raw = ride.total_fare;
                  const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'));
                  return sum + (Number.isFinite(num) ? num : 0);
                }, 0) || 0
              ).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">All time</div>
          </div>
        </div>

        {/* History Toggle */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            <i className="fas fa-check-circle text-accent"></i>
            <span className="text-sm font-medium">History (0)</span>
          </div>
        </div>

        {/* Rides List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="driver-card p-4 animate-pulse">
                <div className="flex justify-between items-start mb-3">
                  <div className="space-y-2">
                    <div className="h-4 bg-secondary rounded w-32"></div>
                    <div className="h-3 bg-secondary rounded w-24"></div>
                  </div>
                  <div className="h-6 bg-secondary rounded w-16"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-secondary rounded w-48"></div>
                  <div className="h-3 bg-secondary rounded w-40"></div>
                </div>
              </div>
            ))}
          </div>
        ) : rides && rides.length > 0 ? (
          <div className="space-y-4">
            {rides.map((ride) => (
              <div key={ride.id} className="driver-card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ride.status === 'completed' ? 'bg-green-100 text-green-800' :
                        ride.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {ride.status === 'completed' ? 'Completed' :
                         ride.status === 'cancelled' ? 'Cancelled' : 'In Progress'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {ride.ride_type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ride.created_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent">
                      {(() => {
                        const raw = ride.total_fare;
                        const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'));
                        return `$${Number.isFinite(num) ? num.toFixed(2) : '0.00'}`;
                      })()}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <div className="flex flex-col items-center mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="w-0.5 h-4 bg-border my-1"></div>
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary">{ride.pickup}</p>
                      <p className="text-sm text-muted-foreground">{ride.dropoff}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                  <button className="text-primary hover:text-primary/80 text-sm font-medium">
                    View Details
                  </button>
                  <button className="text-muted-foreground hover:text-primary text-sm">
                    <i className="fas fa-redo mr-1"></i>
                    Book Again
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Empty State
          <div className="driver-card p-8 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-car text-2xl text-muted-foreground"></i>
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">No Active Rides</h3>
            <p className="text-muted-foreground mb-6">Ready for your next Yah™ adventure?</p>
            <Link href="/">
              <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                <i className="fas fa-crown mr-2"></i>
                Book Your First Ride
              </button>
            </Link>
          </div>
        )}
      </main>

      <BottomNavigation currentPage="history" />
    </div>
  );
}