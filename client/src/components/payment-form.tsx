import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
// @ts-ignore - types available after deps install
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { VITE_STRIPE_PUBLISHABLE_KEY } from "@/lib/config";
import { useTheme } from "next-themes";

interface PaymentFormProps {
  rideId: string;
  requestId: string;
  driverInfo: any;
  amount: number;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

const stripePromise = loadStripe(VITE_STRIPE_PUBLISHABLE_KEY);

function InnerStripePaymentForm({ 
  rideId,
  requestId,
  driverInfo,
  amount,
  onPaymentSuccess, 
  onCancel 
}: PaymentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  const [isFinalizing, setIsFinalizing] = useState(false as boolean);

  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(Number(amount) * 100);
      const res = await apiRequest('POST', '/api/stripe/create-payment-intent', {
        amount: cents,
        currency: 'usd',
        metadata: { rideId, requestId }
      });
      const json = await res.json();
      const clientSecret = json?.clientSecret as string | undefined;
      if (!clientSecret) throw new Error('Missing clientSecret from server');

      if (!stripe || !elements) throw new Error('Stripe not initialized');
      const card = elements.getElement(CardElement);
      if (!card) throw new Error('Card element not found');

      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card }
      });

      if (error) {
        throw new Error(error.message || 'Payment confirmation failed');
      }

      // Payment confirmed by Stripe; wait for server webhook to accept ride
      setIsFinalizing(true);
      toast({ title: 'Payment received', description: 'Finalizing your booking…' });

      const maxAttempts = 30; // ~30s
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const resRide = await apiRequest('GET', `/api/rides/${rideId}`);
          const jsonRide = await resRide.json();
          const status = jsonRide?.ride?.status as string | undefined;
          if (status && (status === 'accepted' || status === 'driver_assigned' || status === 'in_progress')) {
            return true;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
      }
      return true;
    },
    onSuccess: () => {
      setIsFinalizing(false);
      toast({ title: "Payment Successful!", description: "Your payment has been processed." });
      // Invalidate ride queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rides', rideId] });
      onPaymentSuccess();
    },
    onError: (error: any) => {
      setIsFinalizing(false);
      toast({
        title: "Payment Failed",
        description: error.message || "Payment processing failed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processPaymentMutation.mutate();
  };

  return (
    <Card className="glass border-yah-gold/20">
      <CardHeader>
        <CardTitle className="flex items-center text-yah-gold">
          <i className="fas fa-credit-card mr-2"></i>
          Complete Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selected Driver Info */}
        <div className="bg-secondary/50 rounded-xl p-4 border border-border">
          <h3 className="text-lg font-semibold text-white mb-3">Selected Driver</h3>
          
          <div className="flex items-center justify-between">
            {/* Left side - Driver info */}
            <div className="flex items-center space-x-3">
              {/* Driver Avatar */}
              <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-black text-lg"></i>
              </div>
              
              {/* Driver Details */}
              <div>
                <h4 className="font-bold text-white text-lg">
                  {driverInfo?.drivers?.name || 'Test Driver'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  2022 Toyota Camry - ABCD
                </p>
                <div className="flex items-center mt-1">
                  <i className="fas fa-star text-yellow-400 mr-1 text-xs"></i>
                  <span className="text-xs text-muted-foreground">New</span>
                </div>
              </div>
            </div>
            
            {/* Right side - Price */}
            <div className="text-right">
              <p className="font-bold text-2xl text-white">${amount.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total fare</p>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Card Details</Label>
            <div className="p-3 bg-yah-muted/50 border border-yah-gold/30 rounded">
              <CardElement options={{ hidePostalCode: true }} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="submit"
              disabled={processPaymentMutation.isPending || isFinalizing || !stripe || !elements}
              className="flex-1 bg-gradient-gold text-yah-darker font-semibold"
              data-testid="button-processPayment"
            >
              {processPaymentMutation.isPending || isFinalizing ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fas fa-credit-card mr-2"></i>
              )}
              {isFinalizing ? 'Finalizing…' : `Pay $${amount.toFixed(2)}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isFinalizing}
              className="border-yah-gold/30 text-yah-gold"
              data-testid="button-cancelPayment"
            >
              Cancel
            </Button>
          </div>
        </form>

        {/* Security Notice */}
        <div className="text-xs text-muted-foreground text-center">
          <i className="fas fa-shield-alt mr-1"></i>
          Payments are processed securely by Stripe
        </div>
      </CardContent>
    </Card>
  );
}

export default function PaymentForm(props: PaymentFormProps) {
  const { theme } = useTheme();
  const isDark = (theme || "dark") === "dark";

  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: {
          theme: isDark ? 'night' : 'stripe',
          variables: {
            colorPrimary: isDark ? '#EAB308' : '#1F2937',
            colorBackground: isDark ? '#0F172A' : '#FFFFFF',
            colorText: isDark ? '#E5E7EB' : '#111827',
            colorDanger: '#EF4444',
            borderRadius: '10px',
            spacingUnit: '10px',
            fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system'
          }
        }
      }}
    >
      <InnerStripePaymentForm {...props} />
    </Elements>
  );
}