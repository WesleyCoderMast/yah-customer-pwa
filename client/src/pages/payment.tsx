import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import BottomNavigation from "@/components/bottom-navigation";
import PaymentMethodCard from "@/components/payment-method-card";
import { apiRequest } from "@/lib/queryClient";
import type { PaymentMethod, Payment } from "@shared/schema";

export default function PaymentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddPayment, setShowAddPayment] = useState(false);

  const { data: paymentMethodsData, isLoading: loadingMethods } = useQuery({
    queryKey: ['/api/payment-methods', { userId: user?.id }],
    enabled: !!user?.id,
  });

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['/api/payments', { customerId: user?.id }],
    enabled: !!user?.id,
  });

  const addPaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethod: any) => {
      return await apiRequest('POST', '/api/payment-methods', paymentMethod);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-methods'] });
      setShowAddPayment(false);
      toast({
        title: "Payment Method Added",
        description: "Your payment method has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Payment Method",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const paymentMethods = (paymentMethodsData as any)?.paymentMethods || [];
  const payments = (paymentsData as any)?.payments || [];

  const handleAddPaymentMethod = (type: string) => {
    // Mock payment method creation for demo purposes
    const mockPaymentMethod = {
      userId: user?.id,
      type,
      isDefault: paymentMethods.length === 0,
      last4: '4242',
      brand: type === 'apple_pay' ? undefined : 'visa',
      expiryMonth: type === 'credit_card' ? 12 : undefined,
      expiryYear: type === 'credit_card' ? 2028 : undefined,
    };

    addPaymentMethodMutation.mutate(mockPaymentMethod);
  };

  if (loadingMethods || loadingPayments) {
    return (
      <div className="min-h-screen bg-yah-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-gold rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <i className="fas fa-credit-card text-yah-dark text-2xl"></i>
          </div>
          <p className="text-yah-gold font-semibold">Loading payment info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-yah-darker/95 backdrop-blur-sm border-b border-yah-gold/20 p-4">
        <div className="flex items-center space-x-3">
          <i className="fas fa-credit-card text-yah-gold text-2xl"></i>
          <div>
            <h1 className="text-xl font-bold text-white">Payment</h1>
            <p className="text-xs text-gray-400">Manage your payment methods</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Payment Methods */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <i className="fas fa-wallet text-yah-gold mr-2"></i>
              Payment Methods
            </h2>
            <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-gradient-gold text-yah-darker font-semibold ripple"
                  data-testid="button-addPayment"
                >
                  <i className="fas fa-plus mr-1"></i>
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-yah-darker border-yah-gold/20">
                <DialogHeader>
                  <DialogTitle className="text-yah-gold flex items-center">
                    <i className="fas fa-plus mr-2"></i>
                    Add Payment Method
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Button
                    className="w-full justify-start bg-yah-muted/50 hover:bg-yah-gold/20 border border-yah-gold/20 ripple"
                    onClick={() => handleAddPaymentMethod('credit_card')}
                    data-testid="button-addCreditCard"
                  >
                    <i className="fab fa-cc-visa text-yah-gold mr-3"></i>
                    Credit/Debit Card
                  </Button>
                  <Button
                    className="w-full justify-start bg-yah-muted/50 hover:bg-yah-gold/20 border border-yah-gold/20 ripple"
                    onClick={() => handleAddPaymentMethod('apple_pay')}
                    data-testid="button-addApplePay"
                  >
                    <i className="fab fa-apple text-yah-gold mr-3"></i>
                    Apple Pay
                  </Button>
                  <Button
                    className="w-full justify-start bg-yah-muted/50 hover:bg-yah-gold/20 border border-yah-gold/20 ripple"
                    onClick={() => handleAddPaymentMethod('google_pay')}
                    data-testid="button-addGooglePay"
                  >
                    <i className="fab fa-google text-yah-gold mr-3"></i>
                    Google Pay
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {paymentMethods.length === 0 ? (
              <Card className="glass border-yah-gold/20">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-yah-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-credit-card text-yah-gold text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
                  <p className="text-gray-400 mb-6">Add a payment method to book rides</p>
                  <Button
                    onClick={() => setShowAddPayment(true)}
                    className="bg-gradient-gold text-yah-darker font-semibold ripple"
                    data-testid="button-addFirstPayment"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Add Payment Method
                  </Button>
                </CardContent>
              </Card>
            ) : (
              paymentMethods.map((method: PaymentMethod) => (
                <PaymentMethodCard key={method.id} paymentMethod={method} />
              ))
            )}
          </div>
        </section>

        {/* Recent Payments */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <i className="fas fa-receipt text-yah-gold mr-2"></i>
            Recent Payments
          </h2>

          <div className="space-y-3">
            {payments.length === 0 ? (
              <Card className="glass border-yah-gold/20">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-yah-gold/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-receipt text-yah-gold"></i>
                  </div>
                  <h3 className="font-semibold mb-1">No Payments Yet</h3>
                  <p className="text-sm text-gray-400">Your payment history will appear here</p>
                </CardContent>
              </Card>
            ) : (
              payments.slice(0, 5).map((payment: Payment) => (
                <Card key={payment.id} className="glass border-yah-gold/20 card-hover">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium">Ride Payment</p>
                        <p className="text-sm text-gray-400">
                          {(payment as any).created_at ? new Date((payment as any).created_at).toLocaleDateString() : 'Date not available'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-yah-gold">
                          ${parseFloat(payment.amount).toFixed(2)}
                        </p>
                        <Badge
                          variant={payment.status === 'completed' ? 'default' : 'secondary'}
                          className={payment.status === 'completed' ? 'bg-green-500/20 text-green-400' : ''}
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                    {(payment as any).tip && parseFloat((payment as any).tip) > 0 && (
                      <div className="text-xs text-gray-400 flex items-center">
                        <i className="fas fa-heart mr-1"></i>
                        Tip: ${parseFloat((payment as any).tip).toFixed(2)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        {/* Payment Security */}
        <section>
          <Card className="glass border-yah-gold/20">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-yah-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-shield-alt text-yah-gold"></i>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Secure Payments</h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Your payment information is encrypted and secure. All transactions are processed safely.
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center">
                      <i className="fas fa-lock mr-1"></i>
                      256-bit SSL
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-shield-alt mr-1"></i>
                      PCI Compliant
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <BottomNavigation currentPage="profile" />
    </div>
  );
}
