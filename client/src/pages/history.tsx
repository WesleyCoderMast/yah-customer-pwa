import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  person_preference_id?: number | null;
}

export default function History() {
  const { user } = useAuth();

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

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['/api/payments', user?.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/payments?customerId=${user?.id}`);
      return await res.json();
    },
    enabled: !!user?.id,
  });

  const payments = (paymentsData as any)?.payments || [];
  const refunds = (paymentsData as any)?.refunds || [];

  const cancelRefundMutation = useMutation({
    mutationFn: async (refundId: string) => {
      return await apiRequest('POST', `/api/refunds/${refundId}/cancel`);
    },
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
              <h1 className="text-xl font-bold text-primary">Payments & Refunds</h1>
              <p className="text-sm text-muted-foreground">Your transaction history</p>
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
              <span className="text-sm font-medium text-primary">Payments</span>
            </div>
            <div className="text-2xl font-bold text-primary">
              {payments.length}
            </div>
            <div className="text-xs text-muted-foreground">Total records</div>
          </div>
          
          <div className="driver-card p-4">
            <div className="flex items-center space-x-2 mb-2">
              <i className="fas fa-dollar-sign text-accent"></i>
              <span className="text-sm font-medium text-primary">Total Spent</span>
            </div>
            <div className="text-2xl font-bold text-accent">
              ${(
                (payments as any[]).reduce((sum, p) => sum + Math.max(0, parseFloat(p.amount || '0')), 0)
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

        {/* Transactions */}
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
        ) : payments && payments.length > 0 ? (
          <div className="space-y-4">
            {payments.map((p: any) => (
              <div key={p.id || p.reference_id} className="driver-card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        parseFloat(p.amount) >= 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {parseFloat(p.amount) >= 0 ? 'Payment' : 'Refund'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(p.created_at || Date.now()).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Ref: {p.reference_id || '—'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent">
                      {parseFloat(p.amount) >= 0 ? `+$${parseFloat(p.amount).toFixed(2)}` : `-$${Math.abs(parseFloat(p.amount)).toFixed(2)}`}
                    </div>
                  </div>
                </div>

                {parseFloat(p.amount) < 0 && (
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Status: {p.status || 'refunded'}</span>
                    {p.reference_id && (
                      <button
                        onClick={() => cancelRefundMutation.mutate(p.reference_id)}
                        className="text-muted-foreground hover:text-primary text-sm"
                        disabled={cancelRefundMutation.isPending}
                      >
                        <i className="fas fa-ban mr-1"></i>
                        Cancel Refund
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Empty State
          <div className="driver-card p-8 text-center">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-car text-2xl text-muted-foreground"></i>
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">No Transactions</h3>
            <p className="text-muted-foreground mb-6">Your payments and refunds will appear here.</p>
            <Link href="/">
              <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                <i className="fas fa-crown mr-2"></i>
                Book a Ride
              </button>
            </Link>
          </div>
        )}
      </main>

      <BottomNavigation currentPage="history" />
    </div>
  );
}