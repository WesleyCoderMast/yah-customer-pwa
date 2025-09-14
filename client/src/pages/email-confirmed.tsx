import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { authService } from '@/lib/authService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function EmailConfirmed() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get token and email from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const email = urlParams.get('email');
        
        if (!token || !email) {
          setStatus('error');
          toast({
            title: "Invalid Link",
            description: "The confirmation link is invalid or has expired.",
            variant: "destructive",
          });
          return;
        }

        // Call backend to confirm email
        const confirmResponse = await fetch('/api/auth/confirm-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email: decodeURIComponent(email) }),
        });

        if (!confirmResponse.ok) {
          throw new Error('Email confirmation failed');
        }

        // Email confirmation successful - show success message
        setStatus('success');
        
        toast({
          title: "Email Confirmed!",
          description: "Your account has been activated successfully. Please sign in to continue.",
        });
        
        setTimeout(() => {
          setLocation('/');
        }, 3000);
      } catch (error: any) {
        console.error('Email confirmation error:', error);
        setStatus('error');
        toast({
          title: "Confirmation Failed",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    };

    handleEmailConfirmation();
  }, [login, setLocation, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src="/yah-logo.png" 
            alt="Yah Logo" 
            className="w-24 h-24 mx-auto mb-6 rounded-full object-cover shadow-lg"
          />
          <h1 className="text-4xl font-bold text-primary mb-2">
            Yah Customer
          </h1>
          <p className="text-muted-foreground">Premium Ride Experience</p>
        </div>

        <Card className="driver-card">
          <CardHeader>
            <CardTitle className="text-center text-primary flex items-center justify-center">
              {status === 'loading' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {status === 'success' && <CheckCircle className="mr-2 h-5 w-5 text-green-500" />}
              {status === 'error' && <XCircle className="mr-2 h-5 w-5 text-red-500" />}
              {status === 'loading' && 'Confirming Email...'}
              {status === 'success' && 'Email Confirmed!'}
              {status === 'error' && 'Confirmation Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {status === 'loading' && (
              <p className="text-muted-foreground">
                Please wait while we confirm your email address...
              </p>
            )}
            {status === 'success' && (
              <div>
                <p className="text-green-600 mb-4">
                  Your email has been successfully confirmed!
                </p>
                <p className="text-muted-foreground">
                  Redirecting you to the main page...
                </p>
              </div>
            )}
            {status === 'error' && (
              <div>
                <p className="text-red-600 mb-4">
                  There was an issue confirming your email.
                </p>
                <p className="text-muted-foreground">
                  Please try signing up again or contact support.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}