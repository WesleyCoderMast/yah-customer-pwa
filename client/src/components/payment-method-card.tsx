import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import type { PaymentMethod } from "@shared/schema";

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
}

export default function PaymentMethodCard({ paymentMethod }: PaymentMethodCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/payment-methods/${paymentMethod.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-methods'] });
      toast({
        title: "Payment Method Removed",
        description: "Your payment method has been removed successfully",
      });
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Remove Payment Method",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/payment-methods/${paymentMethod.id}`, {
        isDefault: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-methods'] });
      toast({
        title: "Default Payment Method Updated",
        description: "This payment method is now your default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Default",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'credit_card':
      case 'debit_card':
        return 'fa-credit-card';
      case 'apple_pay':
        return 'fa-apple';
      case 'google_pay':
        return 'fa-google';
      default:
        return 'fa-credit-card';
    }
  };

  const getPaymentLabel = (type: string) => {
    switch (type) {
      case 'credit_card':
        return 'Credit Card';
      case 'debit_card':
        return 'Debit Card';
      case 'apple_pay':
        return 'Apple Pay';
      case 'google_pay':
        return 'Google Pay';
      default:
        return type;
    }
  };

  const getBrandIcon = (brand?: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return 'fa-cc-visa';
      case 'mastercard':
        return 'fa-cc-mastercard';
      case 'amex':
      case 'american express':
        return 'fa-cc-amex';
      case 'discover':
        return 'fa-cc-discover';
      default:
        return 'fa-credit-card';
    }
  };

  return (
    <Card className="glass border-yah-gold/20 card-hover" data-testid={`payment-method-${paymentMethod.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-yah-gold/20 rounded-full flex items-center justify-center">
              <i className={`fas ${getPaymentIcon(paymentMethod.type)} text-yah-gold`}></i>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold">{getPaymentLabel(paymentMethod.type)}</h3>
                {paymentMethod.isDefault && (
                  <Badge className="bg-yah-gold/20 text-yah-gold border-yah-gold/30">
                    Default
                  </Badge>
                )}
              </div>
              
              {paymentMethod.last4 && (
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  {paymentMethod.brand && (
                    <i className={`fab ${getBrandIcon(paymentMethod.brand)} text-yah-gold`}></i>
                  )}
                  <span>•••• {paymentMethod.last4}</span>
                  {paymentMethod.expiryMonth && paymentMethod.expiryYear && (
                    <span>
                      {String(paymentMethod.expiryMonth).padStart(2, '0')}/{paymentMethod.expiryYear}
                    </span>
                  )}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-1">
                Added {paymentMethod.createdAt ? new Date(paymentMethod.createdAt).toLocaleDateString() : 'Recently'}
              </p>
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            {!paymentMethod.isDefault && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDefaultMutation.mutate()}
                disabled={setDefaultMutation.isPending}
                className="text-xs border-yah-gold/30 text-yah-gold hover:bg-yah-gold/20"
                data-testid={`button-setDefault-${paymentMethod.id}`}
              >
                {setDefaultMutation.isPending ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  'Set Default'
                )}
              </Button>
            )}
            
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-red-400 hover:bg-red-500/20"
                  data-testid={`button-delete-${paymentMethod.id}`}
                >
                  <i className="fas fa-trash"></i>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-yah-darker border-yah-gold/20">
                <DialogHeader>
                  <DialogTitle className="text-yah-gold">Remove Payment Method</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-gray-300">
                    Are you sure you want to remove this payment method? This action cannot be undone.
                  </p>
                  <div className="flex space-x-3">
                    <Button
                      variant="destructive"
                      onClick={() => deletePaymentMethodMutation.mutate()}
                      disabled={deletePaymentMethodMutation.isPending}
                      className="flex-1"
                      data-testid={`button-confirmDelete-${paymentMethod.id}`}
                    >
                      {deletePaymentMethodMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                      ) : (
                        <i className="fas fa-trash mr-2"></i>
                      )}
                      Remove
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeleteDialog(false)}
                      className="flex-1 border-yah-gold/30 text-yah-gold"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
