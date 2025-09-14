import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authService } from "@/lib/authService";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Please enter both email and password');
      }

      const { user, error } = await authService.signIn({ email, password });
      
      if (error) {
        throw new Error(error);
      }

      if (user) {
        login(user);
        toast({
          title: "Welcome back!",
          description: "You're now logged in",
        });
        
        setTimeout(() => {
          setLocation('/');
        }, 100);
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Sign In Failed", 
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  const goToRegister = () => {
    setLocation('/register');
  };

  return (
    <div className="min-h-screen bg-driver-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/yah-logo.png" 
            alt="Yah Logo" 
            className="w-24 h-24 mx-auto mb-6 rounded-full object-cover shadow-lg"
          />
          <h1 className="text-3xl font-bold text-primary mb-2">Yah Customer</h1>
          <p className="text-muted-foreground">Premium rides at your fingertips</p>
        </div>

        <Card className="driver-card">
          <CardHeader>
            <CardTitle className="text-center text-primary">
              Sign In
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-border"
                  data-testid="input-email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-border pr-10"
                    data-testid="input-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400`}></i>
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
                data-testid="button-sign-in"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt mr-2"></i>
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <Separator className="bg-yah-gold/20" />

            <div className="text-center space-y-3">
              <p className="text-sm text-gray-400">
                Don't have an account?
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={goToRegister}
                className="w-full border-yah-gold/30 text-yah-gold hover:bg-yah-gold/20"
                data-testid="button-go-to-register"
              >
                <i className="fas fa-user-plus mr-2"></i>
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-500">
          <p>Premium taxi service • Secure & Private</p>
          <p className="mt-1">
            <i className="fas fa-shield-alt mr-1"></i>
            Your data is protected
          </p>
        </div>
      </div>
    </div>
  );
}