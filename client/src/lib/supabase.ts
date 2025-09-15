import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL } from './config';

// Supabase configuration using hardcoded values from config
const supabaseUrl = VITE_SUPABASE_URL;
const supabaseAnonKey = VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration values');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Real-time subscription utilities for ride tracking
export class RideTracker {
  private listeners: Map<string, (data: any) => void> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  subscribeToRide(rideId: string, callback: (data: any) => void) {
    this.listeners.set(rideId, callback);
    
    // Poll for ride updates every 3 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${VITE_API_BASE_URL}/api/rides/${rideId}`);
        if (response.ok) {
          const data = await response.json();
          callback(data.ride);
        }
      } catch (error) {
        console.error('Error fetching ride updates:', error);
      }
    }, 3000);
    
    this.intervals.set(rideId, interval);
  }

  unsubscribeFromRide(rideId: string) {
    const interval = this.intervals.get(rideId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(rideId);
    }
    this.listeners.delete(rideId);
  }

  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.listeners.clear();
  }
}

// Location services
export class LocationService {
  static async getCurrentPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  static async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    // In a real app, this would use a geocoding service like Google Maps or Mapbox
    // For now, return mock coordinates
    return {
      lat: 40.7128 + Math.random() * 0.1,
      lng: -74.0060 + Math.random() * 0.1
    };
  }

  static async reverseGeocode(lat: number, lng: number): Promise<string> {
    // In a real app, this would use a reverse geocoding service
    // For now, return a mock address
    return `${Math.floor(Math.random() * 9999)} Sample St, New York, NY`;
  }
}

// Push notification utilities
export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  static async sendNotification(title: string, options?: NotificationOptions) {
    const hasPermission = await this.requestPermission();
    
    if (!hasPermission) {
      return null;
    }

    return new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options
    });
  }

  static scheduleRideNotification(message: string, delay: number = 60000) {
    setTimeout(() => {
      this.sendNotification('Yah Ride Update', {
        body: message,
        tag: 'ride-update'
      });
    }, delay);
  }
}

// Storage utilities for offline support
export class OfflineStorage {
  static setItem(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  static getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  }

  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  }

  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }
}

// Export supabase client as db alias for compatibility
export { supabase as db };
