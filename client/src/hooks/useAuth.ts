import { useState, useEffect } from "react";
import { authService } from "@/lib/authService";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  isPhoneVerified: boolean;
  profileImageUrl?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize authentication state
    let mounted = true;
    
    // Check current user from Supabase
    authService.getCurrentUser().then((currentUser) => {
      if (mounted) {
        setUser(currentUser);
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange((user) => {
      if (mounted) {
        setUser(user);
        // Clean up old localStorage data if it exists
        localStorage.removeItem('yah_user');
        localStorage.removeItem('yah_token');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = (userData: User) => {
    console.log('Login called with user:', userData);
    setUser(userData);
    console.log('User state updated, isAuthenticated should be:', !!userData);
  };

  const logout = async () => {
    try {
      await authService.signOut();
      setUser(null);
      // Clean up old localStorage data if it exists
      localStorage.removeItem('yah_user');
      localStorage.removeItem('yah_token');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if Supabase signout fails
      setUser(null);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
