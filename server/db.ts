import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import dotenv from "dotenv"; // Import dotenv
import { DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_URL } from "./config";

dotenv.config();

// Check if we have Supabase credentials
let supabase: any = null;
let db: any = null;

if (VITE_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  // Use Supabase client for REST API connection
  supabase = createClient(
    VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log("Using Supabase client for database operations");
  
  // Create a mock postgres connection for Drizzle schema validation
  const mockConnection = postgres("postgresql://mock:mock@localhost:5432/mock", {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 1,
  });
  db = drizzle(mockConnection, { schema });
} else if (DATABASE_URL) {
  // Fallback to direct PostgreSQL connection
  const sql = postgres(DATABASE_URL);
  db = drizzle(sql, { schema });
} else {
  throw new Error("Either VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY or DATABASE_URL must be provided");
}

export { supabase, db };





