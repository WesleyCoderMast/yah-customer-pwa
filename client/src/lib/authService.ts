import { supabase } from './supabase';
import type { User } from '../hooks/useAuth';

export interface AuthResponse {
  user: User | null;
  error?: string;
  needsEmailConfirmation?: boolean;
  message?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export const authService = {
  async signUp({ email, password, name, phone }: SignUpData): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone || '',
          }
        }
      });

      if (error) {
        // Handle specific Supabase auth errors
        if (error.message.includes('User already registered')) {
          return { user: null, error: 'An account with this email already exists. Please sign in instead.' };
        }
        return { user: null, error: error.message };
      }

      if (data.user) {
        // Create customer record immediately with Supabase user ID
        try {
          const customerData = {
            id: data.user.id,
            name: name,
            phone: phone || '0000000000',
            email: data.user.email!,
            status: 'active',
            pinCode: 1234,
            fingerprintKey: 'default',
            isVerified: false, // Will be true after email confirmation
            profilePhoto: 'default',
            passwordHash: 'n/a',
            role: 'customer',
            totalRides: 0,
            totalPayments: '0.00',
            isActive: true,
          };

          const response = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customerData),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.warn('Failed to create customer record:', errorText);
          } else {
            console.log('Customer record created successfully');
          }
        } catch (dbError) {
          console.warn('Database customer creation error:', dbError);
        }

        // Send custom backend email confirmation
        try {
          await fetch('/api/auth/send-confirmation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              email: data.user.email,
              name: name
            }),
          });
        } catch (emailError) {
          console.warn('Failed to send confirmation email:', emailError);
        }

        return { 
          user: null, 
          needsEmailConfirmation: true,
          message: 'Please check your email and click the confirmation link to activate your account.'
        };
      }

      return { user: null, error: 'Failed to create user' };
    } catch (error: any) {
      return { user: null, error: error.message || 'Sign up failed' };
    }
  },

  async signIn({ email, password }: SignInData): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        // Fetch customer data from database
        try {
          const customerResponse = await fetch(`/api/customer/profile?customerId=${data.user.id}`);
          let customerData = null;
          
          if (customerResponse.ok) {
            const result = await customerResponse.json();
            customerData = result.customer;
          }
          
          // Use customer data if available, otherwise use Supabase user data
          const user: User = {
            id: data.user.id,
            firstName: customerData?.name?.split(' ')[0] || data.user.user_metadata?.full_name?.split(' ')[0] || 'User',
            lastName: customerData?.name?.split(' ').slice(1).join(' ') || data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            email: data.user.email!,
            isPhoneVerified: data.user.email_confirmed_at ? true : false,
          };
          
          return { user };
        } catch (fetchError) {
          console.warn('Failed to fetch customer data:', fetchError);
          
          // Fallback to Supabase user data
          const user: User = {
            id: data.user.id,
            firstName: data.user.user_metadata?.full_name?.split(' ')[0] || 'User',
            lastName: data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            email: data.user.email!,
            isPhoneVerified: data.user.email_confirmed_at ? true : false,
          };
          return { user };
        }
      }

      return { user: null, error: 'Login failed' };
    } catch (error: any) {
      return { user: null, error: error.message || 'Sign in failed' };
    }
  },

  async signOut(): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error: error.message };
      }
      return {};
    } catch (error: any) {
      return { error: error.message || 'Sign out failed' };
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        return {
          id: user.id,
          firstName: user.user_metadata?.first_name || 'User',
          lastName: user.user_metadata?.last_name || '',
          email: user.email!,
          isPhoneVerified: user.email_confirmed_at ? true : false,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  async resetPassword(email: string): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        return { error: error.message };
      }
      
      return {};
    } catch (error: any) {
      return { error: error.message || 'Password reset failed' };
    }
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user: User = {
          id: session.user.id,
          firstName: session.user.user_metadata?.first_name || 'User',
          lastName: session.user.user_metadata?.last_name || '',
          email: session.user.email!,
          isPhoneVerified: session.user.email_confirmed_at ? true : false,
        };
        callback(user);
      } else {
        callback(null);
      }
    });
  }
};