// Configuration file with hardcoded values
// This replaces all process.env.xxx usage in the backend

// Hardcoded configuration values - replace these with your actual values
export const config = {
  // Supabase Configuration - REPLACE WITH YOUR ACTUAL VALUES
  supabase: {
    url: "https://vkytupgdapdfpfolsmnd.supabase.co", // Replace with your Supabase URL
    anonKey: "sb_publishable_0x5NPLT9yhgOam2X1xmJ6A_Ciofb7qm", // Replace with your Supabase anon key
    serviceRoleKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreXR1cGdkYXBkZnBmb2xzbW5kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjA5ODkyMiwiZXhwIjoyMDY3Njc0OTIyfQ.TwsEr4T_iAxOLxyARXS9qwEfpDs7kWGC_vcz8ZQjrL8" // Replace with your service role key
  },
  
  // Database Configuration - REPLACE WITH YOUR ACTUAL VALUES
  database: {
    url: "postgresql://username:password@localhost:5432/database_name" // Replace with your database URL
  },
  
  // Server Configuration
  server: {
    port: 5000,
    nodeEnv: "development",
    baseUrl: "http://localhost:5000"
  },
  
  // Email Service Configuration - REPLACE WITH YOUR ACTUAL VALUES
  email: {
    smtp: {
      host: "smtp.gmail.com", // Your SMTP host
      port: 587,
      secure: false,
      user: "admin@yahapp.online", // Your email address
      pass: "qcgg uoms klch lvlb" // Your email app password
    },
    from: {
      name: "Yah Support",
      email: "admin@yahapp.online"
    }
  },
  
  // Payment Service Configuration - REPLACE WITH YOUR ACTUAL VALUES
  payments: {
    stripe: {
      secretKey: "sk_test_51RYe20IzN3Kd4YuMtP5Ps9Jb6IwZUfhedADVJkPphClfycD747kTzwZVpWDfjYjAhP80eHyBRSo4K7YR8BcZGdOr00ROWjEhYw", // Replace with your Stripe secret key
      publishableKey: "pk_test_51RYe20IzN3Kd4YuMFQYS3q4IwiibtOwzxKYQbWRiIl4yqBepJcnKTCutWUYeYc9fwMdqRjh6Lph96fvsNK00J6QW00mXQyGTEF", // Replace with your Stripe publishable key
      webhookSecret: "whsec_79a9d0c32c528d891c17b954133c80533e5ee3efa274b5dda140637f638005bf",
    }
  }
};

// Export individual values for easy access (replacing process.env.xxx)
export const VITE_SUPABASE_URL = config.supabase.url;
export const VITE_SUPABASE_ANON_KEY = config.supabase.anonKey;
export const SUPABASE_SERVICE_ROLE_KEY = config.supabase.serviceRoleKey;
export const DATABASE_URL = config.database.url;
export const PORT = config.server.port;
export const NODE_ENV = config.server.nodeEnv;
export const BASE_URL = config.server.baseUrl;

// Email configuration
export const SMTP_HOST = config.email.smtp.host;
export const SMTP_PORT = config.email.smtp.port;
export const SMTP_SECURE = config.email.smtp.secure;
export const SMTP_USER = config.email.smtp.user;
export const SMTP_PASS = config.email.smtp.pass;
export const FROM_NAME = config.email.from.name;
export const FROM_EMAIL = config.email.from.email;

// Payment configuration
export const STRIPE_SECRET_KEY = config.payments.stripe.secretKey;
export const STRIPE_PUBLISHABLE_KEY = config.payments.stripe.publishableKey;
export const STRIPE_WEBHOOK_SECRET = config.payments.stripe.webhookSecret;
