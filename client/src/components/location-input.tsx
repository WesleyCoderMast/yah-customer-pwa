import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LocationSuggestion {
  id: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  type: 'address' | 'establishment' | 'locality';
}

interface LocationInputProps {
  pickupLocation: string;
  dropoffLocation: string;
  onPickupChange: (location: string, lat?: number, lng?: number) => void;
  onDropoffChange: (location: string, lat?: number, lng?: number) => void;
  className?: string;
}

// Location search service using backend API
const locationSearchService = {
  searchLocations: async (query: string): Promise<LocationSuggestion[]> => {
    if (query.length < 2) return [];
    
    try {
      const response = await fetch(`/api/locations/search?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`Location search API error: ${response.status}`);
      }

      const data = await response.json();
      return data.suggestions || [];
      
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      return [];
    }
  }
};

export default function LocationInput({
  pickupLocation,
  dropoffLocation,
  onPickupChange,
  onDropoffChange,
  className
}: LocationInputProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<LocationSuggestion[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropoffSuggestions, setShowDropoffSuggestions] = useState(false);
  const [isLoadingPickup, setIsLoadingPickup] = useState(false);
  const [isLoadingDropoff, setIsLoadingDropoff] = useState(false);
  
  const pickupRef = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);
  const pickupDropdownRef = useRef<HTMLDivElement>(null);
  const dropoffDropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search function with improved rate limiting
  const debouncedSearch = useCallback((query: string, isPickup: boolean) => {
    const timeoutId = setTimeout(async () => {
      if (query.length < 2) {
        if (isPickup) {
          setPickupSuggestions([]);
          setShowPickupSuggestions(false);
        } else {
          setDropoffSuggestions([]);
          setShowDropoffSuggestions(false);
        }
        return;
      }

      if (isPickup) {
        setIsLoadingPickup(true);
      } else {
        setIsLoadingDropoff(true);
      }

      try {
        const suggestions = await locationSearchService.searchLocations(query);
        if (isPickup) {
          setPickupSuggestions(suggestions);
          setShowPickupSuggestions(suggestions.length > 0);
        } else {
          setDropoffSuggestions(suggestions);
          setShowDropoffSuggestions(suggestions.length > 0);
        }
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
        // Show empty state instead of hiding dropdown on error
        if (isPickup) {
          setPickupSuggestions([]);
          setShowPickupSuggestions(true);
        } else {
          setDropoffSuggestions([]);
          setShowDropoffSuggestions(true);
        }
      } finally {
        if (isPickup) {
          setIsLoadingPickup(false);
        } else {
          setIsLoadingDropoff(false);
        }
      }
    }, 500); // Increased debounce to 500ms to reduce API calls

    return () => clearTimeout(timeoutId);
  }, []);

  const handlePickupChange = (value: string) => {
    onPickupChange(value);
    debouncedSearch(value, true);
  };

  const handleDropoffChange = (value: string) => {
    onDropoffChange(value);
    debouncedSearch(value, false);
  };

  const selectPickupSuggestion = (suggestion: LocationSuggestion) => {
    onPickupChange(suggestion.formattedAddress, suggestion.lat, suggestion.lng);
    setShowPickupSuggestions(false);
    setPickupSuggestions([]);
  };

  const selectDropoffSuggestion = (suggestion: LocationSuggestion) => {
    onDropoffChange(suggestion.formattedAddress, suggestion.lat, suggestion.lng);
    setShowDropoffSuggestions(false);
    setDropoffSuggestions([]);
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const { latitude, longitude } = position.coords;
      
      // In a real app, you would reverse geocode the coordinates to get an address
      // For now, we'll use a mock address
      const mockAddress = "Current Location";
      onPickupChange(mockAddress, latitude, longitude);
      
    } catch (error) {
      console.error('Error getting location:', error);
      // Fallback to a default location
      onPickupChange("Unable to get current location", 40.7128, -74.0060);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const swapLocations = () => {
    const tempPickup = pickupLocation;
    onPickupChange(dropoffLocation);
    onDropoffChange(tempPickup);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickupDropdownRef.current && !pickupDropdownRef.current.contains(event.target as Node) && 
          !pickupRef.current?.contains(event.target as Node)) {
        setShowPickupSuggestions(false);
      }
      if (dropoffDropdownRef.current && !dropoffDropdownRef.current.contains(event.target as Node) && 
          !dropoffRef.current?.contains(event.target as Node)) {
        setShowDropoffSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex flex-col items-center z-10">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <div className="w-0.5 h-8 bg-gray-600 my-1"></div>
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        </div>
        
        <div className="pl-8 space-y-6">
          {/* Pickup Location */}
          <div className="relative">
            <Input
              ref={pickupRef}
              type="text"
              placeholder="Pickup location"
              value={pickupLocation}
              onChange={(e) => handlePickupChange(e.target.value)}
              onFocus={() => pickupLocation.length >= 2 && setShowPickupSuggestions(true)}
              className="w-full bg-yah-darker/80 border-yah-gold/30 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-400 focus:border-yah-gold focus:outline-none focus:ring-2 focus:ring-yah-gold/20"
              data-testid="input-pickup"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-yah-gold hover:bg-yah-gold/20 p-1"
              data-testid="button-currentLocation"
            >
              {isGettingLocation ? (
                <i className="fas fa-spinner fa-spin text-sm"></i>
              ) : (
                <i className="fas fa-location-arrow text-sm"></i>
              )}
            </Button>
            
            {/* Pickup Autocomplete Dropdown */}
            {showPickupSuggestions && (
              <div 
                ref={pickupDropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-yah-darker/95 backdrop-blur-sm border border-yah-gold/30 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto"
                data-testid="dropdown-pickup"
              >
                {isLoadingPickup ? (
                  <div className="p-3 text-center text-gray-400">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Searching locations...
                  </div>
                ) : pickupSuggestions.length > 0 ? (
                  pickupSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => selectPickupSuggestion(suggestion)}
                      className="w-full px-4 py-3 text-left hover:bg-yah-gold/20 border-b border-yah-gold/10 last:border-b-0 transition-colors"
                      data-testid={`suggestion-pickup-${suggestion.id}`}
                    >
                      <div className="flex items-start space-x-3">
                        <i className={`fas ${suggestion.type === 'establishment' ? 'fa-building' : suggestion.type === 'address' ? 'fa-map-marker-alt' : 'fa-map'} text-yah-gold mt-1 text-sm`}></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{suggestion.displayName}</p>
                          <p className="text-gray-400 text-sm truncate">{suggestion.formattedAddress}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-400">
                    No locations found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drop-off Location */}
          <div className="relative">
            <Input
              ref={dropoffRef}
              type="text"
              placeholder="Where to?"
              value={dropoffLocation}
              onChange={(e) => handleDropoffChange(e.target.value)}
              onFocus={() => dropoffLocation.length >= 2 && setShowDropoffSuggestions(true)}
              className="w-full bg-yah-darker/80 border-yah-gold/30 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-yah-gold focus:outline-none focus:ring-2 focus:ring-yah-gold/20"
              data-testid="input-dropoff"
            />
            
            {/* Drop-off Autocomplete Dropdown */}
            {showDropoffSuggestions && (
              <div 
                ref={dropoffDropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-yah-darker/95 backdrop-blur-sm border border-yah-gold/30 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto"
                data-testid="dropdown-dropoff"
              >
                {isLoadingDropoff ? (
                  <div className="p-3 text-center text-gray-400">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Searching locations...
                  </div>
                ) : dropoffSuggestions.length > 0 ? (
                  dropoffSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => selectDropoffSuggestion(suggestion)}
                      className="w-full px-4 py-3 text-left hover:bg-yah-gold/20 border-b border-yah-gold/10 last:border-b-0 transition-colors"
                      data-testid={`suggestion-dropoff-${suggestion.id}`}
                    >
                      <div className="flex items-start space-x-3">
                        <i className={`fas ${suggestion.type === 'establishment' ? 'fa-building' : suggestion.type === 'address' ? 'fa-map-marker-alt' : 'fa-map'} text-yah-gold mt-1 text-sm`}></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{suggestion.displayName}</p>
                          <p className="text-gray-400 text-sm truncate">{suggestion.formattedAddress}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-400">
                    No locations found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        {pickupLocation && dropoffLocation && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={swapLocations}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-yah-gold hover:bg-yah-gold/20 p-2"
            data-testid="button-swap"
          >
            <i className="fas fa-exchange-alt"></i>
          </Button>
        )}
      </div>
    </div>
  );
}
