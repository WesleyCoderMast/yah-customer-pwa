import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/login";
import Register from "@/pages/signup";
import Home from "@/pages/home";
import Rides from "@/pages/rides";
import History from "@/pages/history";
import Payment from "@/pages/payment";
import Profile from "@/pages/profile";
import Chat from "@/pages/chat";
import Booking from "@/pages/booking";
import RideTracking from "@/pages/ride-tracking";
import EmailConfirmed from "@/pages/email-confirmed";
import NotFound from "@/pages/not-found";


function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  console.log('Router render - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'user:', user);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <i className="fas fa-crown text-primary text-2xl"></i>
          </div>
          <p className="text-primary font-semibold">Loading Yah...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/email-confirmed" component={EmailConfirmed} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/rides" component={Rides} />
          <Route path="/history" component={History} />
          <Route path="/payment" component={Payment} />
          <Route path="/profile" component={Profile} />
          <Route path="/chat" component={Chat} />
          <Route path="/booking" component={Booking} />
          <Route path="/ride/:rideId" component={RideTracking} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
