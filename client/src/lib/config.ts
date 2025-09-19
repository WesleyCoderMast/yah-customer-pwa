// Frontend configuration file with hardcoded values
// This replaces all import.meta.env.xxx usage in the frontend

export const config = {
  // Supabase Configuration - Using real values from .env
  supabase: {
    url: "https://vkytupgdapdfpfolsmnd.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreXR1cGdkYXBkZnBmb2xzbW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwOTg5MjIsImV4cCI6MjA2NzY3NDkyMn0.lWBBmpKAzjg7OcJh5CC8ox8EV0Hd1zALIineF7ZZCuA"
  },

  // API Configuration
  api: {
    // baseUrl: "http://45.32.7.247/:5000",
    baseUrl: "http://localhost:5000",
    timeout: 10000
  },

  // App Configuration
  app: {
    name: "Yah Customer PWA",
    version: "1.0.0",
    environment: "development"
  },
  
  // Map Configuration
  map: {
    defaultCenter: {
      lat: 40.7128,
      lng: -74.0060
    },
    defaultZoom: 13
  },
  
  // Feature Flags
  features: {
    enableNotifications: true,
    enableOfflineMode: true,
    enableRealTimeTracking: true
  },
  
  // Payment Configuration
  payments: {
    stripe: {
      publishableKey: "pk_test_51RYe20IzN3Kd4YuMFQYS3q4IwiibtOwzxKYQbWRiIl4yqBepJcnKTCutWUYeYc9fwMdqRjh6Lph96fvsNK00J6QW00mXQyGTEF"
    }
  }
};

// Export individual values for easy access (replacing import.meta.env.xxx)
export const VITE_SUPABASE_URL = config.supabase.url;
export const VITE_SUPABASE_ANON_KEY = config.supabase.anonKey;
export const VITE_API_BASE_URL = config.api.baseUrl;
export const VITE_APP_NAME = config.app.name;
export const VITE_APP_VERSION = config.app.version;
export const VITE_APP_ENVIRONMENT = config.app.environment;
export const VITE_STRIPE_PUBLISHABLE_KEY = config.payments.stripe.publishableKey;

// Default export for easy importing
export default config;
