import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface PaymentFormProps {
  rideId: string;
  requestId: string;
  driverInfo: any;
  amount: number;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

export default function PaymentForm({ 
  rideId,
  requestId,
  driverInfo,
  amount,
  onPaymentSuccess, 
  onCancel 
}: PaymentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryDate: '',
    securityCode: '',
    cardHolderName: '',
    country: 'US',
    postalCode: ''
  });

  // Card type detection function
  const getCardType = (cardNumber: string) => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    
    if (cleanNumber.startsWith('4')) {
      return { type: 'visa', logo: 'VISA' };
    } else if (cleanNumber.startsWith('5') || (cleanNumber.startsWith('2') && cleanNumber.length > 1 && parseInt(cleanNumber.substring(0, 2)) >= 22 && parseInt(cleanNumber.substring(0, 2)) <= 27)) {
      return { type: 'mastercard', logo: 'MC' };
    } else if (cleanNumber.startsWith('34') || cleanNumber.startsWith('37')) {
      return { type: 'amex', logo: 'AMEX' };
    } else if (cleanNumber.startsWith('6')) {
      return { type: 'discover', logo: 'DISC' };
    } else if (cleanNumber.startsWith('62')) {
      return { type: 'unionpay', logo: 'UP' };
    } else {
      return { type: 'unknown', logo: '' };
    }
  };

  const cardType = getCardType(paymentData.cardNumber);

  const processPaymentMutation = useMutation({
    mutationFn: async (data: typeof paymentData) => {
      return await apiRequest('POST', '/api/payments/process', {
        rideId,
        requestId,
        amount: amount.toString(),
        ...data
      });
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful!",
        description: "Your payment has been processed and driver confirmed.",
      });
      // Invalidate ride queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rides', rideId] });
      onPaymentSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Payment processing failed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.securityCode || 
        !paymentData.cardHolderName || !paymentData.postalCode) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    processPaymentMutation.mutate(paymentData);
  };

  const formatCardNumber = (value: string) => {
    // Remove all non-digits and limit to 16 characters
    const digits = value.replace(/\D/g, '').slice(0, 16);
    // Add spaces every 4 digits
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiryDate = (value: string) => {
    // Remove all non-digits and limit to 4 characters
    const digits = value.replace(/\D/g, '').slice(0, 4);
    // Add slash after 2 digits
    if (digits.length >= 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
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
          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <div className="relative">
              <Input
                id="cardNumber"
                type="text"
                placeholder="1234 5678 9012 3456"
                value={paymentData.cardNumber}
                onChange={(e) => setPaymentData(prev => ({ 
                  ...prev, 
                  cardNumber: formatCardNumber(e.target.value) 
                }))}
                className="bg-yah-muted border-yah-gold/30 pr-16"
                data-testid="input-cardNumber"
                required
              />
              {/* Card Type Indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {cardType.type !== 'unknown' && (
                  <div className="transition-opacity duration-200">
                    {cardType.type === 'visa' && (
                      <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold tracking-wider">
                        VISA
                      </div>
                    )}
                    {cardType.type === 'mastercard' && (
                      <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">
                        <div className="flex items-center space-x-1">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-400 rounded-full -ml-2"></div>
                        </div>
                      </div>
                    )}
                    {cardType.type === 'amex' && (
                      <div className="bg-blue-800 text-white px-2 py-1 rounded text-xs font-bold">
                        AMEX
                      </div>
                    )}
                    {cardType.type === 'discover' && (
                      <div className="bg-orange-600 text-white px-2 py-1 rounded text-xs font-bold">
                        DISCOVER
                      </div>
                    )}
                    {cardType.type === 'unionpay' && (
                      <div className="bg-red-700 text-white px-1.5 py-1 rounded text-xs font-bold">
                        <div className="text-center">
                          <div className="text-xs leading-tight">银联</div>
                          <div className="text-xs leading-tight">UnionPay</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Card type name display */}
            {cardType.type !== 'unknown' && paymentData.cardNumber.length > 4 && (
              <div className="text-sm text-muted-foreground flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-2"></i>
                {cardType.type === 'visa' && 'Visa Card Detected'}
                {cardType.type === 'mastercard' && 'Mastercard Detected'}
                {cardType.type === 'amex' && 'American Express Detected'}
                {cardType.type === 'discover' && 'Discover Card Detected'}
                {cardType.type === 'unionpay' && 'UnionPay Card Detected'}
              </div>
            )}
          </div>

          {/* Expiry and CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="text"
                placeholder="MM/YY"
                value={paymentData.expiryDate}
                onChange={(e) => setPaymentData(prev => ({ 
                  ...prev, 
                  expiryDate: formatExpiryDate(e.target.value) 
                }))}
                className="bg-yah-muted border-yah-gold/30"
                data-testid="input-expiryDate"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="securityCode">CVV</Label>
              <Input
                id="securityCode"
                type="text"
                placeholder="123"
                maxLength={4}
                value={paymentData.securityCode}
                onChange={(e) => setPaymentData(prev => ({ 
                  ...prev, 
                  securityCode: e.target.value.replace(/\D/g, '') 
                }))}
                className="bg-yah-muted border-yah-gold/30"
                data-testid="input-securityCode"
                required
              />
            </div>
          </div>

          {/* Cardholder Name */}
          <div className="space-y-2">
            <Label htmlFor="cardHolderName">Cardholder Name</Label>
            <Input
              id="cardHolderName"
              type="text"
              placeholder="John Smith"
              value={paymentData.cardHolderName}
              onChange={(e) => setPaymentData(prev => ({ 
                ...prev, 
                cardHolderName: e.target.value 
              }))}
              className="bg-yah-muted border-yah-gold/30"
              data-testid="input-cardHolderName"
              required
            />
          </div>

          {/* Country and ZIP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select 
                value={paymentData.country} 
                onValueChange={(value) => setPaymentData(prev => ({ ...prev, country: value }))}
              >
                <SelectTrigger className="bg-yah-muted border-yah-gold/30" data-testid="select-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">ZIP Code</Label>
              <Input
                id="postalCode"
                type="text"
                placeholder="12345"
                value={paymentData.postalCode}
                onChange={(e) => setPaymentData(prev => ({ 
                  ...prev, 
                  postalCode: e.target.value 
                }))}
                className="bg-yah-muted border-yah-gold/30"
                data-testid="input-postalCode"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="submit"
              disabled={processPaymentMutation.isPending}
              className="flex-1 bg-gradient-gold text-yah-darker font-semibold"
              data-testid="button-processPayment"
            >
              {processPaymentMutation.isPending ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fas fa-credit-card mr-2"></i>
              )}
              Pay ${amount.toFixed(2)}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
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
          Your payment is secured by Wise and encrypted end-to-end
        </div>
      </CardContent>
    </Card>
  );
}