import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import LocationInput from "@/components/location-input";
import RideTypeSelector from "@/components/ride-type-selector";
import RouteMap from "@/components/route-map";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { VITE_SUPABASE_ANON_KEY } from "@/lib/config";

type BookingStep = 'trip-area' | 'category' | 'ride-type' | 'passengers' | 'open-door' | 'driver-preferences' | 'locations' | 'confirmation';

interface BookingData {
  tripArea: 'in-city' | 'out-of-city';
  destinationCity?: string;
  destinationState?: string;
  category: string;
  rideType: string;
  passengerCount: number;
  petCount: number;
  doorOpeningRequested: boolean;
  personPreferenceId: number; // References person_preferences table
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedTime: number;
  estimatedDistance: number;
  scheduledFor: Date | null;
}

// Enhanced Location Selection Component
interface LocationSelectionViewProps {
  bookingData: BookingData;
  setBookingData: React.Dispatch<React.SetStateAction<BookingData>>;
  calculateVehicleCount: () => number;
  calculateFare: () => any;
  setConfirmationPrice: React.Dispatch<React.SetStateAction<string | null>>;
}

function LocationSelectionView({ bookingData, setBookingData, calculateVehicleCount, calculateFare, setConfirmationPrice }: LocationSelectionViewProps) {
  const [showRoute, setShowRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeETA, setRouteETA] = useState<number>(0);
  const [routePrice, setRoutePrice] = useState<string>("0.00");
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [supabasePrice, setSupabasePrice] = useState<string | null>(null);

  // Calculate route distance using coordinates
  const calculateRouteDistance = async () => {
    if (bookingData.pickupLat && bookingData.pickupLng && bookingData.dropoffLat && bookingData.dropoffLng) {
      // Use Haversine formula for distance calculation
      const R = 3959; // Earth's radius in miles
      const dLat = (bookingData.dropoffLat - bookingData.pickupLat) * Math.PI / 180;
      const dLng = (bookingData.dropoffLng - bookingData.pickupLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(bookingData.pickupLat * Math.PI / 180) * Math.cos(bookingData.dropoffLat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      // Estimate ETA (assuming 25 mph average speed)
      const eta = Math.round(distance * 60 / 25);
      
      setRouteDistance(distance);
      setRouteETA(eta);
      
      // Update booking data
      setBookingData(prev => ({
        ...prev,
        estimatedDistance: distance,
        estimatedTime: eta
      }));
      
      // Calculate updated price
      const fareDetails = calculateFare();
      setRoutePrice(fareDetails.total.toFixed(2));
    }
  };

  // Fetch pricing from Supabase edge function
  const fetchSupabasePrice = async (forConfirmation = false) => {
    if (!bookingData.pickupLat || !bookingData.pickupLng || !bookingData.dropoffLat || !bookingData.dropoffLng) {
      return;
    }

    setIsLoadingPrice(true);
    try {
      // Calculate distance first (same as in route-map.tsx)
      const R = 3959; // Earth's radius in miles
      const dLat = (bookingData.dropoffLat - bookingData.pickupLat) * Math.PI / 180;
      const dLng = (bookingData.dropoffLng - bookingData.pickupLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(bookingData.pickupLat * Math.PI / 180) * Math.cos(bookingData.dropoffLat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      const duration = Math.round(distance * 60 / 25); // Assume 25 mph average speed

      const requestBody = {
        miles: distance,
        minutes: duration,
        people: bookingData.passengerCount,
        pets: bookingData.petCount,
        rideType: bookingData.rideType,
        cars: Math.ceil(bookingData.passengerCount / 4) // Calculate vehicles needed
      };
      
      console.log('Pricing API request:', requestBody);
      
      const response = await fetch('https://vkytupgdapdfpfolsmnd.supabase.co/functions/v1/supabase-functions-YAH_QUOTE_URL-index-ts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pricing API response:', data);
        const price = data.price?.toFixed(2) || '0.00';
        // Always set both prices for consistency
        setSupabasePrice(price);
        setConfirmationPrice(price);
      } else {
        const errorText = await response.text();
        console.error('Pricing API error:', response.status, errorText);
        // Always set both prices for consistency
        setSupabasePrice('Error');
        setConfirmationPrice('Error');
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      // Always set both prices for consistency
      setSupabasePrice('Error');
      setConfirmationPrice('Error');
    } finally {
      setIsLoadingPrice(false);
    }
  };

  // Update distance when locations change
  useEffect(() => {
    if (bookingData.pickupLocation && bookingData.dropoffLocation) {
      calculateRouteDistance();
    }
  }, [bookingData.pickupLat, bookingData.pickupLng, bookingData.dropoffLat, bookingData.dropoffLng]);

  return (
    <div className="space-y-6">
      {/* Location Input Fields */}
      <div className="space-y-4">
        <LocationInput
          pickupLocation={bookingData.pickupLocation || ''}
          dropoffLocation={bookingData.dropoffLocation || ''}
          onPickupChange={(location: string, lat?: number, lng?: number) => 
            setBookingData(prev => ({ 
              ...prev, 
              pickupLocation: location,
              pickupLat: lat || 0,
              pickupLng: lng || 0 
            }))
          }
          onDropoffChange={(location: string, lat?: number, lng?: number) => 
            setBookingData(prev => ({ 
              ...prev, 
              dropoffLocation: location,
              dropoffLat: lat || 0,
              dropoffLng: lng || 0 
            }))
          }
        />
      </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            className="bg-gray-50 dark:bg-gray-700 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Use My Location
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setShowRoute(true);
              // Always trigger route update when clicked
              if (bookingData.pickupLat && bookingData.pickupLng && bookingData.dropoffLat && bookingData.dropoffLng) {
                calculateRouteDistance();
              }
            }}
            className="bg-gray-50 dark:bg-gray-700 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            data-testid="button-show-route"
          >
            Show Route Details
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchSupabasePrice(false)}
            disabled={isLoadingPrice || !bookingData.pickupLocation || !bookingData.dropoffLocation}
            className="bg-gray-50 dark:bg-gray-700 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
            data-testid="button-get-price"
          >
            {isLoadingPrice ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Getting Price...
              </>
            ) : (
              'Get Yah Price'
            )}
          </Button>
          {supabasePrice && (
            <div className="flex items-center text-green-600 dark:text-green-400 font-medium">
              <i className="fas fa-dollar-sign mr-1"></i>
              ${supabasePrice}
            </div>
          )}
      </div>

      {/* Route Map Section - Only visible when route is shown */}
      {showRoute && bookingData.pickupLocation && bookingData.dropoffLocation && (
        <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
          {/* Real OpenStreetMap with Route */}
          <RouteMap
            pickupLat={bookingData.pickupLat || 0}
            pickupLng={bookingData.pickupLng || 0}
            dropoffLat={bookingData.dropoffLat || 0}
            dropoffLng={bookingData.dropoffLng || 0}
            pickupLocation={bookingData.pickupLocation}
            dropoffLocation={bookingData.dropoffLocation}
            rideType={bookingData.rideType}
            passengerCount={bookingData.passengerCount}
            petCount={bookingData.petCount}
            showRoute={showRoute}
            onRouteUpdate={(distance, duration, price) => {
              setRouteDistance(distance);
              setRouteETA(duration);
              const formattedPrice = price.toFixed(2);
              setRoutePrice(formattedPrice);
              setConfirmationPrice(formattedPrice); // Use same price for confirmation
              setBookingData(prev => ({
                ...prev,
                estimatedDistance: distance,
                estimatedTime: duration
              }));
            }}
          />
          
          {/* Route Details - Only show when showRoute is true */}
          {showRoute && (
            <>
              <div className="mb-4">
                <h3 className="text-white font-medium mb-2">Yah Secure Estimate</h3>
                <p className="text-slate-400 text-sm mb-3">
                  {bookingData.pickupLocation} → {bookingData.dropoffLocation}
                </p>
                <p className="text-green-400 text-sm">Route shown.</p>
              </div>
              
              {/* Stats Grid - Mobile Optimized 2x2 Layout */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center mb-2">
                    <i className="fas fa-route text-blue-400 text-sm mr-2"></i>
                    <p className="text-slate-400 text-xs font-medium">Distance</p>
                  </div>
                  <p className="text-white font-bold text-sm">{routeDistance.toFixed(2)} km</p>
                  <p className="text-slate-400 text-xs">{(routeDistance * 0.621371).toFixed(2)} miles</p>
                </div>
                <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center mb-2">
                    <i className="fas fa-clock text-green-400 text-sm mr-2"></i>
                    <p className="text-slate-400 text-xs font-medium">ETA</p>
                  </div>
                  <p className="text-white font-bold text-sm">{routeETA} min</p>
                  <p className="text-slate-400 text-xs">estimated time</p>
                </div>
                <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center mb-2">
                    <i className="fas fa-car text-yellow-400 text-sm mr-2"></i>
                    <p className="text-slate-400 text-xs font-medium">Vehicles</p>
                  </div>
                  <p className="text-white font-bold text-sm">{calculateVehicleCount()}</p>
                  <p className="text-slate-400 text-xs">required</p>
                </div>
                <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center mb-2">
                    <i className="fas fa-dollar-sign text-blue-400 text-sm mr-2"></i>
                    <p className="text-slate-400 text-xs font-medium">Price</p>
                  </div>
                  <p className="text-white font-bold text-sm">${routePrice}</p>
                  <p className="text-slate-400 text-xs">estimate</p>
                </div>
              </div>
              
              {/* Map App Links */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 text-xs hover:bg-gray-200 dark:hover:bg-gray-500"
                  onClick={() => {
                    // Try to open default map app on mobile with driving directions
                    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
                      window.open(`maps://?saddr=${bookingData.pickupLat},${bookingData.pickupLng}&daddr=${bookingData.dropoffLat},${bookingData.dropoffLng}&dirflg=d`, '_blank');
                    } else if (navigator.userAgent.match(/Android/i)) {
                      window.open(`google.navigation:q=${bookingData.dropoffLat},${bookingData.dropoffLng}&mode=d`, '_blank');
                    } else {
                      window.open(`https://www.google.com/maps/dir/${bookingData.pickupLat},${bookingData.pickupLng}/${bookingData.dropoffLat},${bookingData.dropoffLng}/@${(bookingData.pickupLat + bookingData.dropoffLat)/2},${(bookingData.pickupLng + bookingData.dropoffLng)/2},10z/data=!3m1!4b1!4m2!4m1!3e0`, '_blank');
                    }
                  }}
                  data-testid="button-open-default-maps"
                >
                  Open in My Maps App
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 text-xs hover:bg-gray-200 dark:hover:bg-gray-500"
                  onClick={() => {
                    window.open(`http://maps.apple.com/?saddr=${bookingData.pickupLat},${bookingData.pickupLng}&daddr=${bookingData.dropoffLat},${bookingData.dropoffLng}&dirflg=d`, '_blank');
                  }}
                  data-testid="button-apple-maps"
                >
                  Apple Maps
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 text-xs hover:bg-gray-200 dark:hover:bg-gray-500"
                  onClick={() => {
                    window.open(`https://www.google.com/maps/dir/${bookingData.pickupLat},${bookingData.pickupLng}/${bookingData.dropoffLat},${bookingData.dropoffLng}/@${(bookingData.pickupLat + bookingData.dropoffLat)/2},${(bookingData.pickupLng + bookingData.dropoffLng)/2},10z/data=!3m1!4b1!4m2!4m1!3e0`, '_blank');
                  }}
                  data-testid="button-google-maps"
                >
                  Google Maps
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 text-xs hover:bg-gray-200 dark:hover:bg-gray-500"
                  onClick={() => {
                    window.open(`https://waze.com/ul?ll=${bookingData.dropoffLat}%2C${bookingData.dropoffLng}&navigate=yes&from=${bookingData.pickupLat}%2C${bookingData.pickupLng}&utm_campaign=waze_website&utm_source=waze_website&utm_medium=lm_share_location`, '_blank');
                  }}
                  data-testid="button-waze"
                >
                  Waze
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Booking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isBooking, setIsBooking] = useState(false);
  const [currentStep, setCurrentStep] = useState<BookingStep>('trip-area');
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [confirmationPrice, setConfirmationPrice] = useState<string | null>(null);
  
  const [bookingData, setBookingData] = useState<BookingData>({
    tripArea: 'in-city',
    category: '',
    rideType: '',
    passengerCount: 1,
    petCount: 0,
    doorOpeningRequested: false,
    personPreferenceId: 6, // Default to "General (All)" preference
    pickupLocation: '',
    dropoffLocation: '',
    pickupLat: 0,
    pickupLng: 0,
    dropoffLat: 0,
    dropoffLng: 0,
    estimatedTime: 15,
    estimatedDistance: 5.2,
    scheduledFor: null,
  });

  // Vehicle capacity (seats per vehicle type)
  const VEHICLE_CAPACITY = 4; // Standard vehicle capacity
  
  const bookRideMutation = useMutation({
    mutationFn: async (rideData: any) => {
      return await apiRequest('POST', '/api/rides', rideData);
    },
    onSuccess: (response) => {
      toast({
        title: "Ride Booked Successfully!",
        description: "Searching for available drivers...",
      });
      // Navigate to ride tracking
      response.json().then(data => {
        setLocation(`/ride/${data.ride.id}`);
      });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsBooking(false);
    },
  });

  // Multi-vehicle assignment logic
  const calculateVehicleCount = () => {
    return Math.ceil(bookingData.passengerCount / VEHICLE_CAPACITY);
  };
  
  // Fetch pricing from Supabase edge function
  const fetchSupabasePrice = async (forConfirmation = false) => {
    if (!bookingData.pickupLat || !bookingData.pickupLng || !bookingData.dropoffLat || !bookingData.dropoffLng) {
      return;
    }

    setIsLoadingPrice(true);
    try {
      // Calculate distance first (same as in route-map.tsx)
      const R = 3959; // Earth's radius in miles
      const dLat = (bookingData.dropoffLat - bookingData.pickupLat) * Math.PI / 180;
      const dLng = (bookingData.dropoffLng - bookingData.pickupLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(bookingData.pickupLat * Math.PI / 180) * Math.cos(bookingData.dropoffLat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      const duration = Math.round(distance * 60 / 25); // Assume 25 mph average speed

      const requestBody = {
        miles: distance,
        minutes: duration,
        people: bookingData.passengerCount,
        pets: bookingData.petCount,
        rideType: bookingData.rideType,
        cars: Math.ceil(bookingData.passengerCount / 4) // Calculate vehicles needed
      };
      
      console.log('Pricing API request:', requestBody);
      
      const response = await fetch('https://vkytupgdapdfpfolsmnd.supabase.co/functions/v1/supabase-functions-YAH_QUOTE_URL-index-ts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pricing API response:', data);
        const price = data.price?.toFixed(2) || '0.00';
        if (forConfirmation) {
          setConfirmationPrice(price);
        }
      } else {
        const errorText = await response.text();
        console.error('Pricing API error:', response.status, errorText);
        if (forConfirmation) {
          setConfirmationPrice('Error');
        }
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      if (forConfirmation) {
        setConfirmationPrice('Error');
      }
    } finally {
      setIsLoadingPrice(false);
    }
  };
  
  // Skip fetching pricing for confirmation step since it's already set from route calculation
  // useEffect(() => {
  //   if (currentStep === 'confirmation' && !confirmationPrice) {
  //     fetchSupabasePrice(true);
  //   }
  // }, [currentStep]);
  
  // Comprehensive fare calculation with multi-vehicle support
  const calculateFare = () => {
    const vehicleCount = calculateVehicleCount();
    
    // Base fares by ride type (per vehicle)
    const baseFares: Record<string, number> = {
      // In-City Regular
      'YahNow': 8.00,
      'YahGo': 8.00,
      'YahSwift': 10.00,
      'YahChoice': 12.00,
      'YahSolo': 8.00,
      'YahGroup': 15.00,
      'YahFamily': 12.00,
      'YahPet': 10.00,
      'YahQuiet': 9.00,
      'YahSilent': 9.00,
      
      // In-City Individual
      'YahYouth': 7.00,
      'YahYoungGirl': 7.00,
      'YahYoungBoy': 7.00,
      'YahMan': 8.00,
      'YahWoman': 8.00,
      'YahSenior': 6.00,
      'YahSingle': 8.00,
      
      // In-City Relationship
      'YahCouple': 15.00,
      'YahEngagement': 18.00,
      'YahUnion': 16.00,
      'YahDating': 14.00,
      'YahMarriage': 20.00,
      'YahWedding': 25.00,
      'YahMatch': 12.00,
      'YahPure': 14.00,
      
      // In-City Event
      'YahBirthday': 15.00,
      'YahValentine': 18.00,
      'YahParty': 20.00,
      'YahInvitation': 16.00,
      
      // In-City Protected
      'YahArmy': 12.00,
      'YahMilitary': 12.00,
      'YahSecurity': 14.00,
      
      // In-City Luxury
      'YahRoyal': 35.00,
      'YahCelebrity': 45.00,
      'YahElite': 30.00,
      
      // In-City Service
      'YahBusiness': 15.00,
      'YahMedical': 12.00,
      
      // Out-of-City Travel
      'YahTravelNow': 25.00,
      'YahTravelGo': 25.00,
      'YahTravelSwift': 30.00,
      'YahTravelChoice': 35.00,
      'YahTravelYouth': 22.00,
      'YahTravelYoungGirl': 22.00,
      'YahTravelYoungBoy': 22.00,
      'YahTravelMan': 25.00,
      'YahTravelWoman': 25.00,
      'YahTravelSenior': 20.00,
      'YahTravelSingle': 25.00,
      'YahTravelSolo': 25.00,
      'YahTravelGroup': 40.00,
      'YahTravelFamily': 35.00,
      'YahTravelBusiness': 40.00,
      'YahTravelMedical': 30.00,
      'YahTravelEngagement': 45.00,
      'YahTravelUnion': 40.00,
      'YahTravelMarriage': 50.00,
      'YahTravelHoneymoon': 55.00,
      'YahTravelMatch': 35.00,
      'YahTravelPure': 40.00,
      'YahTravelArmy': 30.00,
      'YahTravelMilitary': 30.00,
      'YahTravelSecurity': 35.00,
      'YahTravelRoyal': 75.00,
      'YahTravelCelebrity': 90.00,
      'YahTravelElite': 65.00,
      'YahTravelQuiet': 28.00,
      'YahTravelSilent': 28.00,
    };
    
    const baseFare = baseFares[bookingData.rideType] || 8.00;
    
    // Calculate total for all vehicles
    const totalBaseFare = baseFare * vehicleCount;
    
    // Distance and time based fees (per vehicle)
    const distanceFee = Math.max(0, (bookingData.estimatedDistance - 2)) * 2.50;
    const timeFee = Math.max(0, (bookingData.estimatedTime - 10)) * 0.50;
    const totalDistanceFee = distanceFee * vehicleCount;
    const totalTimeFee = timeFee * vehicleCount;
    
    // Passenger fee (only for additional passengers beyond first)
    const passengerFee = Math.max(0, (bookingData.passengerCount - 1)) * 2.00;
    
    // Pet fee
    const petFee = bookingData.petCount * 5.00;
    
    // Multi-vehicle tip (if more than 1 vehicle)
    const multiVehicleTip = vehicleCount > 1 ? vehicleCount * 5.00 : 0;
    
    return {
      baseFare: totalBaseFare,
      distanceFee: totalDistanceFee,
      timeFee: totalTimeFee,
      passengerFee,
      petFee,
      multiVehicleTip,
      total: totalBaseFare + totalDistanceFee + totalTimeFee + passengerFee + petFee + multiVehicleTip,
      vehicleCount
    };
  };

  // Navigation helpers
  const nextStep = () => {
    const steps: BookingStep[] = ['trip-area', 'category', 'ride-type', 'passengers', 'open-door', 'driver-preferences', 'locations', 'confirmation'];
    const currentIndex = steps.indexOf(currentStep);
    
    // Always show open-door step - removed auto-skip logic
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };
  
  const prevStep = () => {
    const steps: BookingStep[] = ['trip-area', 'category', 'ride-type', 'passengers', 'open-door', 'driver-preferences', 'locations', 'confirmation'];
    const currentIndex = steps.indexOf(currentStep);
    
    // Always show open-door step when going back - removed auto-skip logic
    
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };
  
  const getRideTypeDetails = (rideTypeId: string) => {
    // Ride types that require Open Door service
    const openDoorRideTypes = [
      'YahYouth', 'YahYoungGirl', 'YahYoungBoy', 'YahWoman', 'YahSenior',
      'YahCouple', 'YahEngagement', 'YahUnion', 'YahDating', 'YahMarriage', 'YahWedding', 'YahMatch', 'YahPure',
      'YahBirthday', 'YahValentine', 'YahParty', 'YahInvitation',
      'YahArmy', 'YahMilitary', 'YahSecurity',
      'YahRoyal', 'YahCelebrity', 'YahElite',
      'YahMedical',
      'YahTravelYouth', 'YahTravelYoungGirl', 'YahTravelYoungBoy', 'YahTravelWoman', 'YahTravelSenior',
      'YahTravelMedical', 'YahTravelEngagement', 'YahTravelUnion', 'YahTravelMarriage', 'YahTravelHoneymoon',
      'YahTravelMatch', 'YahTravelPure', 'YahTravelArmy', 'YahTravelMilitary', 'YahTravelSecurity',
      'YahTravelRoyal', 'YahTravelCelebrity', 'YahTravelElite'
    ];
    
    return {
      openDoorRequired: openDoorRideTypes.includes(rideTypeId)
    };
  };
  
  const getRideTypeName = (rideType: string) => {
    // Since we now store the title directly, just return it
    return rideType || 'Selected Ride Type';
  };
  
  const handleBookRide = () => {
    if (!bookingData.pickupLocation || !bookingData.dropoffLocation) {
      toast({
        title: "Missing Locations",
        description: "Please enter both pickup and drop-off locations",
        variant: "destructive",
      });
      return;
    }

    setIsBooking(true);
    
    const rideData = {
      customer_id: user?.id || '',
      pickup: bookingData.pickupLocation || '',
      dropoff: bookingData.dropoffLocation || '',
      ride_type: bookingData.rideType || '',
      status: 'pending',
      distance_miles: bookingData.estimatedDistance || 5.0,
      duration_minutes: bookingData.estimatedTime || 15.0,
      rider_count: bookingData.passengerCount || 1,
      pet_count: bookingData.petCount || 0,
      open_door_requested: bookingData.doorOpeningRequested || false,
      person_preference_id: bookingData.personPreferenceId,
      total_fare: confirmationPrice ? parseFloat(confirmationPrice) : 0.0,
    };

    // Debug logging
    console.log('Booking data personPreferenceId:', bookingData.personPreferenceId);
    console.log('Ride data person_preference_id:', rideData.person_preference_id);
    console.log('Full ride data:', rideData);

    bookRideMutation.mutate(rideData);
  };

  // Get step title
  const getStepTitle = () => {
    const titles = {
      'trip-area': 'Where is your ride?',
      'category': bookingData.tripArea === 'in-city' ? 'Choose a ride category' : 'Choose a travel category',
      'ride-type': 'Pick one ride type',
      'passengers': 'How many people and pets are riding?',
      'open-door': 'Door opening service?',
      'driver-preferences': 'Driver preferences',
      'locations': 'Set your pickup and drop-off locations',
      'confirmation': 'Confirm your booking'
    };
    return titles[currentStep];
  };
  
  const canProceed = () => {
    switch (currentStep) {
      case 'trip-area':
        return !!bookingData.tripArea;
      case 'category':
        return !!bookingData.category;
      case 'ride-type':
        return !!bookingData.rideType;
      case 'passengers':
        return bookingData.passengerCount >= 1;
      case 'open-door':
        return true; // Always can proceed
      case 'driver-preferences':
        return true; // Always can proceed
      case 'locations':
        return !!bookingData.pickupLocation && !!bookingData.dropoffLocation;
      case 'confirmation':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-slate-800/95 backdrop-blur-sm p-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => currentStep === 'trip-area' ? setLocation('/') : prevStep()}
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-700 rounded-lg transition-colors"
            data-testid="button-back"
          >
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">Book Your Ride</h1>
            <p className="text-sm text-slate-300">{getStepTitle()}</p>
          </div>
          <div className="text-sm text-slate-300 font-medium">
            Step {['trip-area', 'category', 'ride-type', 'passengers', 'open-door', 'driver-preferences', 'locations', 'confirmation'].indexOf(currentStep) + 1} of 8
          </div>
        </div>
      </header>

      <main className="p-4">
        {/* Step Content */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          {renderStepContent()}
        </div>
        
        {/* Navigation Buttons */}
        <div className="mt-8 space-y-4">
          {currentStep !== 'confirmation' ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-next"
            >
              <div className="flex items-center justify-center">
                <span>Continue</span>
                <i className="fas fa-arrow-right ml-2"></i>
              </div>
            </button>
          ) : (
            <button
              onClick={handleBookRide}
              disabled={isBooking || !canProceed()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-confirmBooking"
            >
              {isBooking ? (
                <div className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Booking Your Ride...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <i className="fas fa-crown mr-2"></i>
                  Confirm Booking - ${confirmationPrice || '0.00'}
                </div>
              )}
            </button>
          )}
          
          {currentStep !== 'trip-area' && (
            <button
              onClick={prevStep}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-6 rounded-xl transition-colors"
              data-testid="button-previous"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back
            </button>
          )}
        </div>
      </main>
    </div>
  );
  
  // Render content for current step
  function renderStepContent() {
    switch (currentStep) {
      case 'trip-area':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-white mb-3">Where is your ride?</h2>
              <p className="text-slate-300 text-sm">Choose In-City for local rides. Choose Out-of-City / Out-of-State for longer trips.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setBookingData(prev => ({ ...prev, tripArea: 'in-city', category: '', rideType: '' }))}
                className={cn(
                  "p-4 rounded-xl text-left transition-all duration-300 border-2",
                  bookingData.tripArea === 'in-city'
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                    : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                )}
                data-testid="trip-area-in-city"
              >
                <div className="flex items-center">
                  <i className="fas fa-city text-3xl mr-4"></i>
                  <div>
                    <h3 className="text-xl font-bold mb-1">In-City</h3>
                    <p className="text-sm opacity-80">Within the same city</p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setBookingData(prev => ({ ...prev, tripArea: 'out-of-city', category: '', rideType: '' }))}
                className={cn(
                  "p-4 rounded-xl text-left transition-all duration-300 border-2",
                  bookingData.tripArea === 'out-of-city'
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                    : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                )}
                data-testid="trip-area-out-of-city"
              >
                <div className="flex items-center">
                  <i className="fas fa-plane text-3xl mr-4"></i>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Out-of-City / Out-of-State</h3>
                    <p className="text-sm opacity-80">Traveling to another city or state</p>
                  </div>
                </div>
              </button>
            </div>
            
            {bookingData.tripArea === 'out-of-city' && (
              <div className="space-y-4 mt-6 p-4 bg-muted/50 rounded-xl">
                <div>
                  <label className="block text-sm font-medium mb-2 text-primary">Destination City</label>
                  <Input
                    value={bookingData.destinationCity || ''}
                    onChange={(e) => setBookingData(prev => ({ ...prev, destinationCity: e.target.value }))}
                    placeholder="Enter destination city"
                    className="bg-input border-border text-foreground"
                    data-testid="input-destination-city"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-primary">Destination State/Province</label>
                  <Input
                    value={bookingData.destinationState || ''}
                    onChange={(e) => setBookingData(prev => ({ ...prev, destinationState: e.target.value }))}
                    placeholder="Enter destination state/province"
                    className="bg-input border-border text-foreground"
                    data-testid="input-destination-state"
                  />
                </div>
              </div>
            )}
          </div>
        );
        
      case 'category':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-primary mb-2">
                {bookingData.tripArea === 'in-city' ? 'Choose a ride category' : 'Choose a travel category'}
              </h2>
              <p className="text-muted-foreground">Select the type of service that best fits your needs.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {(bookingData.tripArea === 'in-city' ? [
                { id: 'regular', name: 'Regular Rides', icon: 'fa-car-side', description: 'Standard rides' },
                { id: 'individual', name: 'Individual Rides', icon: 'fa-user', description: 'Personal service' },
                { id: 'relationship', name: 'Relationship Rides', icon: 'fa-heart', description: 'Special connections' },
                { id: 'event', name: 'Event Rides', icon: 'fa-star', description: 'Special occasions' },
                { id: 'protected', name: 'Protected Rides', icon: 'fa-shield-alt', description: 'Secure service' },
                { id: 'luxury', name: 'Luxury Rides', icon: 'fa-crown', description: 'Premium experience' },
                { id: 'service', name: 'Service Rides', icon: 'fa-briefcase', description: 'Professional needs' },
              ] : [
                { id: 'travel-basic', name: 'Travel – Basic', icon: 'fa-plane', description: 'Standard travel' },
                { id: 'travel-individual', name: 'Travel – Individual', icon: 'fa-user-friends', description: 'Personal travel' },
                { id: 'travel-group', name: 'Travel – Group', icon: 'fa-users', description: 'Group travel' },
                { id: 'travel-purpose', name: 'Travel – Purpose', icon: 'fa-briefcase', description: 'Business/medical' },
                { id: 'travel-relationship', name: 'Travel – Relationship', icon: 'fa-heart', description: 'Special occasions' },
                { id: 'travel-protected', name: 'Travel – Protected', icon: 'fa-shield-alt', description: 'Secure travel' },
                { id: 'travel-luxury', name: 'Travel – Luxury', icon: 'fa-crown', description: 'Premium travel' },
                { id: 'travel-quiet', name: 'Travel – Quiet', icon: 'fa-volume-mute', description: 'Silent journey' },
              ]).map((category) => (
                <button
                  key={category.id}
                  onClick={() => setBookingData(prev => ({ ...prev, category: category.id, rideType: '' }))}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all duration-300 border-2",
                    bookingData.category === category.id
                      ? "bg-primary text-primary-foreground border-primary shadow-lg"
                      : "bg-card text-card-foreground border-border hover:border-primary/60"
                  )}
                  data-testid={`category-${category.id}`}
                >
                  <div className="flex items-center">
                    <i className={`fas ${category.icon} text-2xl mr-4`}></i>
                    <div>
                      <h3 className="text-lg font-bold mb-1">{category.name}</h3>
                      <p className="text-sm opacity-80">{category.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
        
      case 'ride-type':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-primary mb-2">Pick one ride type</h2>
              <p className="text-muted-foreground">Choose the specific service that meets your needs.</p>
            </div>
            
            <RideTypeSelector
              selectedRideType={bookingData.rideType}
              onRideTypeChange={(rideType) => setBookingData(prev => ({ ...prev, rideType }))}
              tripArea={bookingData.tripArea}
              selectedCategory={bookingData.category}
            />
          </div>
        );
        
      case 'passengers':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-primary mb-2">How many people and pets are riding?</h2>
              <p className="text-muted-foreground">Include everyone riding, including yourself. Each rider needs one seat.</p>
            </div>
            
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <i className="fas fa-users text-primary mr-3 text-2xl"></i>
                  <div>
                    <p className="text-xl font-medium">Passengers</p>
                    <p className="text-sm text-muted-foreground">+$2 per additional person after first</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-6">
                <button
                  className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary/40 transition-colors"
                  onClick={() => setBookingData(prev => ({ ...prev, passengerCount: Math.max(1, prev.passengerCount - 1) }))}
                  data-testid="button-passenger-minus"
                >
                  <i className="fas fa-minus text-lg"></i>
                </button>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary" data-testid="text-passengerCount">
                    {bookingData.passengerCount}
                  </div>
                  <div className="text-sm text-muted-foreground">people</div>
                </div>
                <button
                  className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary/40 transition-colors"
                  onClick={() => setBookingData(prev => ({ ...prev, passengerCount: Math.min(20, prev.passengerCount + 1) }))}
                  data-testid="button-passenger-plus"
                >
                  <i className="fas fa-plus text-lg"></i>
                </button>
              </div>
              
              {calculateVehicleCount() > 1 && (
                <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
                  <div className="flex items-center text-blue-300 mb-2">
                    <i className="fas fa-info-circle mr-2"></i>
                    <span className="font-medium">Multi-Vehicle Assignment</span>
                  </div>
                  <p className="text-sm text-blue-200">
                    {calculateVehicleCount()} vehicles will be assigned to accommodate all {bookingData.passengerCount} passengers.
                    Each driver will receive an additional $5+ tip.
                  </p>
                </div>
              )}
            </div>
            
            {/* Pets Section */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <i className="fas fa-paw text-primary mr-3 text-2xl"></i>
                  <div>
                    <p className="text-xl font-medium">Pets</p>
                    <p className="text-sm text-muted-foreground">$5 per pet</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-6">
                <button
                  className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary/40 transition-colors"
                  onClick={() => setBookingData(prev => ({ ...prev, petCount: Math.max(0, prev.petCount - 1) }))}
                  data-testid="button-pet-minus"
                >
                  <i className="fas fa-minus text-lg"></i>
                </button>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary" data-testid="text-petCount">
                    {bookingData.petCount}
                  </div>
                  <div className="text-sm text-muted-foreground">pets</div>
                </div>
                <button
                  className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center hover:bg-primary/40 transition-colors"
                  onClick={() => setBookingData(prev => ({ ...prev, petCount: Math.min(10, prev.petCount + 1) }))}
                  data-testid="button-pet-plus"
                >
                  <i className="fas fa-plus text-lg"></i>
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'open-door':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-white mb-3">Door opening service?</h2>
              <p className="text-slate-300 text-sm">Would you like your driver to open the door for you?</p>
              <p className="text-xs text-slate-400 mt-2">Driver can step out and open the door at pickup and drop-off if you want this service.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setBookingData(prev => ({ ...prev, doorOpeningRequested: true }))}
                className={cn(
                  "p-4 rounded-xl text-left transition-all duration-300 border-2",
                  bookingData.doorOpeningRequested
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                    : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                )}
                data-testid="door-opening-yes"
              >
                <div className="flex items-center">
                  <i className="fas fa-door-open text-3xl mr-4"></i>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Yes, please</h3>
                    <p className="text-sm opacity-80">Driver will open the door for you</p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setBookingData(prev => ({ ...prev, doorOpeningRequested: false }))}
                className={cn(
                  "p-4 rounded-xl text-left transition-all duration-300 border-2",
                  !bookingData.doorOpeningRequested
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                    : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                )}
                data-testid="door-opening-no"
              >
                <div className="flex items-center">
                  <i className="fas fa-times-circle text-3xl mr-4"></i>
                  <div>
                    <h3 className="text-xl font-bold mb-1">No, thanks</h3>
                    <p className="text-sm opacity-80">I'll handle the doors myself</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        );
        
      case 'driver-preferences':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-white mb-3">Driver preferences</h2>
              <p className="text-slate-300 text-sm">Let us know your preferences for the driver (optional).</p>
            </div>
            
            {/* Driver Preference Options */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    console.log('Setting personPreferenceId to 1 (Female Only)');
                    setBookingData(prev => ({ 
                      ...prev, 
                      personPreferenceId: 1 // Female Only
                    }));
                  }}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all duration-300 border-2",
                    bookingData.personPreferenceId === 1
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                      : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                  )}
                  data-testid="driver-preference-female"
                >
                  <div className="flex items-center">
                    <i className="fas fa-female text-3xl mr-4"></i>
                    <div>
                      <h3 className="text-xl font-bold mb-1">Female drivers only</h3>
                      <p className="text-sm opacity-80">Prefer a female driver</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setBookingData(prev => ({ 
                    ...prev, 
                    personPreferenceId: 2 // Male Only
                  }))}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all duration-300 border-2",
                    bookingData.personPreferenceId === 2
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                      : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                  )}
                  data-testid="driver-preference-male"
                >
                  <div className="flex items-center">
                    <i className="fas fa-male text-3xl mr-4"></i>
                    <div>
                      <h3 className="text-xl font-bold mb-1">Male drivers only</h3>
                      <p className="text-sm opacity-80">Prefer a male driver</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setBookingData(prev => ({ 
                    ...prev, 
                    personPreferenceId: 3 // Deaf Only
                  }))}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all duration-300 border-2",
                    bookingData.personPreferenceId === 3
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                      : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                  )}
                  data-testid="driver-preference-deaf"
                >
                  <div className="flex items-center">
                    <i className="fas fa-hand-paper text-3xl mr-4"></i>
                    <div>
                      <h3 className="text-xl font-bold mb-1">Deaf or hard-of-hearing drivers only</h3>
                      <p className="text-sm opacity-80">Prefer a deaf or hard-of-hearing driver</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setBookingData(prev => ({ 
                    ...prev, 
                    personPreferenceId: 4 // Hearing Only
                  }))}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all duration-300 border-2",
                    bookingData.personPreferenceId === 4
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                      : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                  )}
                  data-testid="driver-preference-hearing"
                >
                  <div className="flex items-center">
                    <i className="fas fa-ear-listen text-3xl mr-4"></i>
                    <div>
                      <h3 className="text-xl font-bold mb-1">Hearing drivers only</h3>
                      <p className="text-sm opacity-80">Prefer a hearing driver</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setBookingData(prev => ({ 
                    ...prev, 
                    personPreferenceId: 5 // Disabled Only
                  }))}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all duration-300 border-2",
                    bookingData.personPreferenceId === 5
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                      : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                  )}
                  data-testid="driver-preference-disabled"
                >
                  <div className="flex items-center">
                    <i className="fas fa-wheelchair text-3xl mr-4"></i>
                    <div>
                      <h3 className="text-xl font-bold mb-1">Drivers comfortable with disabilities</h3>
                      <p className="text-sm opacity-80">Prefer a driver experienced with disabilities</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    console.log('Setting personPreferenceId to 6 (No preference)');
                    setBookingData(prev => ({ 
                      ...prev, 
                      personPreferenceId: 6 // General (All)
                    }));
                  }}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all duration-300 border-2",
                    bookingData.personPreferenceId === 6
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg"
                      : "bg-slate-700 text-white border-slate-600 hover:border-blue-500"
                  )}
                  data-testid="driver-preference-general"
                >
                  <div className="flex items-center">
                    <i className="fas fa-user-friends text-3xl mr-4"></i>
                    <div>
                      <h3 className="text-xl font-bold mb-1">No preference</h3>
                      <p className="text-sm opacity-80">Any driver is fine</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'locations':
        return <LocationSelectionView 
          bookingData={bookingData} 
          setBookingData={setBookingData}
          calculateVehicleCount={calculateVehicleCount}
          calculateFare={calculateFare}
          setConfirmationPrice={setConfirmationPrice}
        />;
        
      case 'confirmation':        
        
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-white mb-3">Confirm your booking</h2>
              <p className="text-slate-300 text-sm">Review your ride details before confirming.</p>
            </div>
            
            {/* Ride Summary */}
            <div className="space-y-4">
              <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                <h3 className="font-semibold text-white mb-3">Ride Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Trip Type:</span>
                    <span className="text-white">{bookingData.tripArea === 'in-city' ? 'In-City' : 'Out-of-City/State'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Ride Type:</span>
                    <span className="text-white">{getRideTypeName(bookingData.rideType)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Passengers:</span>
                    <span className="text-white">{bookingData.passengerCount}</span>
                  </div>
                  {bookingData.petCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">Pets:</span>
                      <span className="text-white">{bookingData.petCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-300">Vehicles:</span>
                    <span className="text-white">{calculateVehicleCount()}</span>
                  </div>
                  {bookingData.doorOpeningRequested && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">Door Service:</span>
                      <span className="text-white">Requested</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Driver Preferences */}
              <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                <h3 className="font-semibold text-white mb-3">Driver Preferences</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Preference:</span>
                    <span className="text-white">
                      {bookingData.personPreferenceId === 1 ? 'Female drivers only' :
                       bookingData.personPreferenceId === 2 ? 'Male drivers only' :
                       bookingData.personPreferenceId === 3 ? 'Deaf or hard-of-hearing drivers only' :
                       bookingData.personPreferenceId === 4 ? 'Hearing drivers only' :
                       bookingData.personPreferenceId === 5 ? 'Drivers comfortable with disabilities' :
                       'No preference'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">ID:</span>
                    <span className="text-white text-xs">{bookingData.personPreferenceId}</span>
                  </div>
                </div>
              </div>
              
              {/* Locations */}
              <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                <h3 className="font-semibold text-white mb-3">Locations</h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1 mr-3"></div>
                    <div>
                      <p className="text-xs text-slate-400">Pickup</p>
                      <p className="text-sm text-white">{bookingData.pickupLocation}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-3 h-3 bg-red-500 rounded-full mt-1 mr-3"></div>
                    <div>
                      <p className="text-xs text-slate-400">Drop-off</p>
                      <p className="text-sm text-white">{bookingData.dropoffLocation}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Total Price Section */}
              <div className="bg-slate-700 rounded-xl p-4 border border-slate-600">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-white text-lg">Total</h3>
                  <div className="text-right">
                    {isLoadingPrice ? (
                      <div className="flex items-center text-lg font-bold text-blue-400">
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Loading...
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-blue-400" data-testid="text-totalFare">
                        ${confirmationPrice || '0.00'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return <div>Unknown step</div>;
    }
  }
}