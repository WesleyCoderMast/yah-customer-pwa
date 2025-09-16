import { 
  customers,
  paymentMethods,
  drivers,
  rideTypes,
  rides,
  payments,
  yahMessages,
  driverReports,
  savedLocations,
  rideRequests,
  yahChatSessions,
  rapydBeneficiaries,
  driverPayouts,
  paymentSplits,
  type Customer,
  type InsertCustomer,
  type PaymentMethod,
  type InsertPaymentMethod,
  type Driver,
  type RideType,
  type InsertRideType,
  type Ride,
  type InsertRide,
  type Payment,
  type InsertPayment,
  type ChatMessage,
  type InsertChatMessage,
  type DriverReport,
  type InsertDriverReport,
  type SavedLocation,
  type InsertSavedLocation,
  type RideRequest,
  type InsertRideRequest,
  type YahChatSession,
  type InsertYahChatSession,
  type RapydBeneficiary,
  type InsertRapydBeneficiary,
  type DriverPayout,
  type InsertDriverPayout,
  type PaymentSplit,
  type InsertPaymentSplit,
} from "@shared/schema";
import { supabase } from "./db";
import { eq, and, desc, sql, asc } from "drizzle-orm";

export interface IStorage {
  // Customer operations
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phoneNumber: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer>;
  
  // Payment method operations
  getPaymentMethods(customerId: string): Promise<PaymentMethod[]>;
  createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod>;
  updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod>;
  deletePaymentMethod(id: string): Promise<void>;
  
  // Driver operations
  getAvailableDrivers(lat: number, lng: number, rideType: string): Promise<Driver[]>;
  getDriver(id: string): Promise<Driver | undefined>;
  
  // Ride type operations
  getRideTypes(): Promise<RideType[]>;
  getRideType(id: string): Promise<RideType | undefined>;
  getRideTypesByCategory(category: string): Promise<RideType[]>;
  createRideType(rideType: InsertRideType): Promise<RideType>;
  updateRideType(id: string, updates: Partial<RideType>): Promise<RideType>;
  
  // Ride operations
  createRide(ride: InsertRide): Promise<Ride>;
  getRide(id: string): Promise<Ride | undefined>;
  getUserRides(customerId: string): Promise<Ride[]>;
  updateRide(id: string, updates: Partial<Ride>): Promise<Ride>;
  cancelRide(id: string, reason: string): Promise<Ride>;
  
  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment>;
  getUserPayments(customerId: string): Promise<Payment[]>;
  
  // Chat operations
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(customerId: string, rideId?: string): Promise<ChatMessage[]>;
  
  // Driver report operations
  createDriverReport(report: InsertDriverReport): Promise<DriverReport>;
  
  // Saved location operations
  getSavedLocations(customerId: string): Promise<SavedLocation[]>;
  createSavedLocation(location: InsertSavedLocation): Promise<SavedLocation>;
  deleteSavedLocation(id: string): Promise<void>;
  
  // Ride request operations (driver bidding system)
  getRideRequests(rideId: string): Promise<RideRequest[]>;
  getRideRequest(id: string): Promise<RideRequest | undefined>;
  createRideRequest(request: InsertRideRequest): Promise<RideRequest>;
  updateRideRequest(id: string, updates: Partial<RideRequest>): Promise<RideRequest>;
  
  // Rapyd beneficiary operations
  createRapydBeneficiary(beneficiary: InsertRapydBeneficiary): Promise<RapydBeneficiary>;
  getRapydBeneficiary(id: string): Promise<RapydBeneficiary | undefined>;
  getRapydBeneficiaryByDriver(driverId: string): Promise<RapydBeneficiary | undefined>;
  updateRapydBeneficiary(id: string, updates: Partial<RapydBeneficiary>): Promise<RapydBeneficiary>;
  
  // Driver payout operations
  createDriverPayout(payout: InsertDriverPayout): Promise<DriverPayout>;
  getDriverPayout(id: string): Promise<DriverPayout | undefined>;
  getDriverPayouts(driverId: string): Promise<DriverPayout[]>;
  updateDriverPayout(id: string, updates: Partial<DriverPayout>): Promise<DriverPayout>;
  getPendingPayouts(): Promise<DriverPayout[]>;
  
  // Payment split operations
  createPaymentSplit(split: InsertPaymentSplit): Promise<PaymentSplit>;
  getPaymentSplit(id: string): Promise<PaymentSplit | undefined>;
  getPaymentSplitByPayment(paymentId: number): Promise<PaymentSplit | undefined>;
  updatePaymentSplit(id: string, updates: Partial<PaymentSplit>): Promise<PaymentSplit>;
}

export class DatabaseStorage implements IStorage {
  // Customer operations
  async getCustomer(id: string): Promise<Customer | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching customer:', error);
      return undefined;
    }
    return data;
  }

  async getCustomerByPhone(phoneNumber: string): Promise<Customer | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phoneNumber)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching customer by phone:', error);
      return undefined;
    }
    return data;
  }

  async createCustomer(customerData: InsertCustomer & { id?: string }): Promise<Customer> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    try {
      // Map camelCase to snake_case for database
      const dbData = {
        id: customerData.id || undefined,
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        status: customerData.status,
        pin_code: customerData.pinCode,
        fingerprint_key: customerData.fingerprintKey,
        is_verified: customerData.isVerified,
        profile_photo: customerData.profilePhoto,
        password_hash: customerData.passwordHash,
        role: customerData.role,
        total_rides: customerData.totalRides,
        total_payments: customerData.totalPayments,
        is_active: customerData.isActive,
        // created_at is auto-generated by database
      };
      
      // Debug removed for production
      
      const { data, error } = await supabase
        .from('customers')
        .insert(dbData)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase customer creation error:', error);
        
        // Handle duplicate key constraint violation
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          throw new Error('Customer with this email already exists');
        }
        
        throw new Error(`Failed to create customer: ${error.message || 'Database error'}`);
      }
      return data;
    } catch (err: any) {
      console.error('Customer creation error:', err);
      throw new Error(`Failed to create customer: ${err.message}`);
    }
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    // Map camelCase to snake_case for database updates
    const dbUpdates: any = {};
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key];
      switch (key) {
        case 'isVerified':
          dbUpdates.is_verified = value;
          break;
        case 'pinCode':
          dbUpdates.pin_code = value;
          break;
        case 'fingerprintKey':
          dbUpdates.fingerprint_key = value;
          break;
        case 'profilePhoto':
          dbUpdates.profile_photo = value;
          break;
        case 'passwordHash':
          dbUpdates.password_hash = value;
          break;
        case 'totalRides':
          dbUpdates.total_rides = value;
          break;
        case 'totalPayments':
          dbUpdates.total_payments = value;
          break;
        case 'isActive':
          dbUpdates.is_active = value;
          break;
        case 'joinedAt':
          dbUpdates.joined_at = value;
          break;
        default:
          dbUpdates[key] = value;
      }
    });
    
    const { data, error } = await supabase
      .from('customers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`);
    }
    return data;
  }


  // Payment method operations
  async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
    return data || [];
  }

  async createPaymentMethod(paymentMethodData: InsertPaymentMethod): Promise<PaymentMethod> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        ...paymentMethodData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create payment method: ${error.message}`);
    }
    return data;
  }

  async updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payment_methods')
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update payment method: ${error.message}`);
    }
    return data;
  }

  async deletePaymentMethod(id: string): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);
  }

  // Driver operations
  async getAvailableDrivers(lat: number, lng: number, rideType: string): Promise<Driver[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('is_active', true)
      .limit(10);
    
    if (error) {
      console.error('Error fetching drivers:', error);
      return [];
    }
    return data || [];
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching driver:', error);
      return undefined;
    }
    return data;
  }

  // Ride operations
  async createRide(rideData: InsertRide): Promise<Ride> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('rides')
      .insert(rideData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create ride: ${error.message}`);
    }
    return data;
  }

  async getRide(id: string): Promise<Ride | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching ride:', error);
      return undefined;
    }
    return data;
  }

  async getUserRides(customerId: string): Promise<Ride[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching user rides:', error);
      return [];
    }
    return data || [];
  }

  async updateRide(id: string, updates: Partial<Ride>): Promise<Ride> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('rides')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update ride: ${error.message}`);
    }
    return data;
  }

  async cancelRide(id: string, reason: string): Promise<Ride> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('rides')
      .update({ 
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel ride: ${error.message}`);
    }
    return data;
  }

  // Payment operations - simplified for demo (not fully implemented)
  async createPayment(paymentData: InsertPayment): Promise<Payment> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();
    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }
    return data;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching payment:', error);
      return undefined;
    }
    return data;
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payments')
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update payment: ${error.message}`);
    }
    return data;
  }

  async updatePaymentByReference(referenceId: string, updates: Partial<Payment>): Promise<Payment | null> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('reference_id', referenceId)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No payment found with this reference ID
        console.warn(`No payment found with reference ID: ${referenceId}`);
        return null;
      }
      throw new Error(`Failed to update payment: ${error.message}`);
    }
    return data;
  }

  async getUserPayments(customerId: string): Promise<Payment[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('customerId', customerId)
      .order('createdAt', { ascending: false });
    
    if (error) {
      console.error('Error fetching user payments:', error);
      return [];
    }
    return data || [];
  }

  // Chat operations - simplified for demo
  async createChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        ...messageData,
        createdAt: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create chat message: ${error.message}`);
    }
    return data;
  }

  async getChatMessages(customerId: string, rideId?: string): Promise<ChatMessage[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    let query = supabase.from('chat_messages').select('*').eq('customerId', customerId);
    
    if (rideId) {
      query = query.eq('rideId', rideId);
    }
    
    const { data, error } = await query.order('createdAt', { ascending: true });
    
    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
    return data || [];
  }

  // YahChat session operations
  async getActiveChatSessions(customerId: string, driverId?: string, rideId?: string): Promise<YahChatSession[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    let query = supabase
      .from('yah_chat_sessions')
      .select('*')
      .eq('is_active', true)
      .eq('customer_id', customerId);
    
    if (driverId) {
      query = query.eq('driver_id', driverId);
    }
    
    if (rideId) {
      query = query.eq('ride_id', rideId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching active chat sessions:', error);
      return [];
    }
    return data || [];
  }

  async createChatSession(sessionData: InsertYahChatSession): Promise<YahChatSession> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('yah_chat_sessions')
      .insert({
        ...sessionData,
        room_name: sessionData.room_name || `room${sessionData.ride_id}`,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
    return data;
  }

  async updateChatSession(id: string, updates: Partial<YahChatSession>): Promise<YahChatSession> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('yah_chat_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update chat session: ${error.message}`);
    }
    return data;
  }

  // Driver report operations - simplified for demo
  async createDriverReport(reportData: InsertDriverReport): Promise<DriverReport> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('driver_reports')
      .insert({
        ...reportData,
        createdAt: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create driver report: ${error.message}`);
    }
    return data;
  }

  // Saved location operations
  async getSavedLocations(customerId: string): Promise<SavedLocation[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('customerId', customerId)
      .order('createdAt', { ascending: true });
    
    if (error) {
      console.error('Error fetching saved locations:', error);
      return [];
    }
    return data || [];
  }

  async createSavedLocation(locationData: InsertSavedLocation): Promise<SavedLocation> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('saved_locations')
      .insert({
        ...locationData,
        createdAt: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create saved location: ${error.message}`);
    }
    return data;
  }

  async deleteSavedLocation(id: string): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    await supabase
      .from('saved_locations')
      .delete()
      .eq('id', id);
  }

  // Ride type operations
  async getRideTypes(): Promise<RideType[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('ride_types')
      .select('*')
      .eq('active', true)
      .order('title', { ascending: true });
    
    if (error) {
      console.error('Error fetching ride types:', error);
      return [];
    }
    return data || [];
  }

  async getRideType(id: string): Promise<RideType | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('ride_types')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching ride type:', error);
      return undefined;
    }
    return data;
  }

  async getRideTypesByCategory(category: string): Promise<RideType[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('ride_types')
      .select('*')
      .eq('active', true)
      .ilike('title', `%${category}%`)
      .order('title', { ascending: true });
    
    if (error) {
      console.error('Error fetching ride types by category:', error);
      return [];
    }
    return data || [];
  }

  async createRideType(rideTypeData: InsertRideType): Promise<RideType> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('ride_types')
      .insert({
        ...rideTypeData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create ride type: ${error.message}`);
    }
    return data;
  }

  async updateRideType(id: string, updates: Partial<RideType>): Promise<RideType> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    const { data, error } = await supabase
      .from('ride_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update ride type: ${error.message}`);
    }
    return data;
  }

  // Ride request operations (driver bidding system)
  async getRideRequests(rideId: string): Promise<RideRequest[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    // First get the ride requests
    const { data: requests, error: requestsError } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: false });
    
    if (requestsError) {
      console.error('Error fetching ride requests:', requestsError);
      return [];
    }
    
    if (!requests || requests.length === 0) {
      return [];
    }
    
    // Then get driver info for each request
    const requestsWithDrivers = await Promise.all(
      requests.map(async (request: any) => {
        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select(`
            id,
            name,
            phone,
            email,
            vehicle_type
          `)
          .eq('id', request.driver_id)
          .single();
        
        if (driverError) {
          console.error('Error fetching driver for request:', driverError);
          return { ...request, drivers: null };
        }
        
        return { ...request, drivers: driver };
      })
    );
    
    return requestsWithDrivers;
  }

  async getRideRequest(id: string): Promise<RideRequest | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    // First get the ride request
    const { data: request, error: requestError } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('id', id)
      .single();
    
    if (requestError && requestError.code !== 'PGRST116') {
      console.error('Error fetching ride request:', requestError);
      return undefined;
    }
    
    if (!request) {
      return undefined;
    }
    
    // Then get driver info
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select(`
        id,
        name,
        phone,
        email
      `)
      .eq('id', request.driver_id)
      .single();
    
    if (driverError) {
      console.error('Error fetching driver for request:', driverError);
      return { ...request, drivers: null };
    }
    
    return { ...request, drivers: driver };
  }

  async createRideRequest(requestData: InsertRideRequest): Promise<RideRequest> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    // First create the ride request
    const { data: request, error: requestError } = await supabase
      .from('ride_requests')
      .insert({
        ride_id: requestData.ride_id,
        driver_id: requestData.driver_id,
        customer_id: requestData.customer_id,
        pickup: requestData.pickup,
        dropoff: requestData.dropoff,
        ride_count: requestData.ride_count,
        pet_count: requestData.pet_count,
        estimated_distance: requestData.estimated_distance,
        estimated_duration: requestData.estimated_duration,
        estimated_fare_min: requestData.estimated_fare_min,
        estimated_fare_max: requestData.estimated_fare_max,
        notes: requestData.notes,
        status: requestData.status || 'requested',
      })
      .select('*')
      .single();
    
    if (requestError) {
      throw new Error(`Failed to create ride request: ${requestError.message}`);
    }
    
    // Then get driver info
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select(`
        id,
        name,
        phone,
        email
      `)
      .eq('id', request.driver_id)
      .single();
    
    if (driverError) {
      console.error('Error fetching driver for new request:', driverError);
      return { ...request, drivers: null };
    }
    
    return { ...request, drivers: driver };
  }

  async updateRideRequest(id: string, updates: Partial<RideRequest>): Promise<RideRequest> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    // Map updates to database fields
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.pickup !== undefined) dbUpdates.pickup = updates.pickup;
    if (updates.dropoff !== undefined) dbUpdates.dropoff = updates.dropoff;
    if (updates.estimated_distance !== undefined) dbUpdates.estimated_distance = updates.estimated_distance;
    if (updates.estimated_duration !== undefined) dbUpdates.estimated_duration = updates.estimated_duration;
    if (updates.estimated_fare_min !== undefined) dbUpdates.estimated_fare_min = updates.estimated_fare_min;
    if (updates.estimated_fare_max !== undefined) dbUpdates.estimated_fare_max = updates.estimated_fare_max;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.accepted_at !== undefined) dbUpdates.accepted_at = updates.accepted_at;
    if (updates.cancelled_at !== undefined) dbUpdates.cancelled_at = updates.cancelled_at;
    
    // First update the ride request
    const { data: request, error: requestError } = await supabase
      .from('ride_requests')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();
    
    if (requestError) {
      throw new Error(`Failed to update ride request: ${requestError.message}`);
    }
    
    // Then get driver info
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select(`
        id,
        name,
        phone,
        email
      `)
      .eq('id', request.driver_id)
      .single();
    
    if (driverError) {
      console.error('Error fetching driver for updated request:', driverError);
      return { ...request, drivers: null };
    }
    
    return { ...request, drivers: driver };
  }

  // Rapyd beneficiary operations
  async createRapydBeneficiary(beneficiary: InsertRapydBeneficiary): Promise<RapydBeneficiary> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('rapyd_beneficiaries')
      .insert(beneficiary)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to create Rapyd beneficiary: ${error.message}`);
    }
    
    return data;
  }

  async getRapydBeneficiary(id: string): Promise<RapydBeneficiary | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('rapyd_beneficiaries')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching Rapyd beneficiary:', error);
      return undefined;
    }
    
    return data;
  }

  async getRapydBeneficiaryByDriver(driverId: string): Promise<RapydBeneficiary | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('rapyd_beneficiaries')
      .select('*')
      .eq('driver_id', driverId)
      .eq('beneficiary_type', 'driver')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching driver Rapyd beneficiary:', error);
      return undefined;
    }
    
    return data;
  }

  async updateRapydBeneficiary(id: string, updates: Partial<RapydBeneficiary>): Promise<RapydBeneficiary> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('rapyd_beneficiaries')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to update Rapyd beneficiary: ${error.message}`);
    }
    
    return data;
  }

  // Driver payout operations
  async createDriverPayout(payout: InsertDriverPayout): Promise<DriverPayout> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('driver_payouts')
      .insert(payout)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to create driver payout: ${error.message}`);
    }
    
    return data;
  }

  async getDriverPayout(id: string): Promise<DriverPayout | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('driver_payouts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching driver payout:', error);
      return undefined;
    }
    
    return data;
  }

  async getDriverPayouts(driverId: string): Promise<DriverPayout[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('driver_payouts')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching driver payouts:', error);
      return [];
    }
    
    return data || [];
  }

  async updateDriverPayout(id: string, updates: Partial<DriverPayout>): Promise<DriverPayout> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('driver_payouts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to update driver payout: ${error.message}`);
    }
    
    return data;
  }

  async getPendingPayouts(): Promise<DriverPayout[]> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('driver_payouts')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching pending payouts:', error);
      return [];
    }
    
    return data || [];
  }

  // Payment split operations
  async createPaymentSplit(split: InsertPaymentSplit): Promise<PaymentSplit> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('payment_splits')
      .insert(split)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to create payment split: ${error.message}`);
    }
    
    return data;
  }

  async getPaymentSplit(id: string): Promise<PaymentSplit | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching payment split:', error);
      return undefined;
    }
    
    return data;
  }

  async getPaymentSplitByPayment(paymentId: number): Promise<PaymentSplit | undefined> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('payment_id', paymentId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching payment split by payment:', error);
      return undefined;
    }
    
    return data;
  }

  async updatePaymentSplit(id: string, updates: Partial<PaymentSplit>): Promise<PaymentSplit> {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    const { data, error } = await supabase
      .from('payment_splits')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to update payment split: ${error.message}`);
    }
    
    return data;
  }
}

export const storage = new DatabaseStorage();
