export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface LocationSearchResult {
  address: string;
  lat: number;
  lng: number;
  place_id?: string;
}

export class LocationService {
  private static instance: LocationService;
  private watchId: number | null = null;

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          try {
            location.address = await this.reverseGeocode(location.lat, location.lng);
          } catch (error) {
            console.warn('Failed to reverse geocode current location:', error);
          }

          resolve(location);
        },
        (error) => {
          let message = 'Failed to get current location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out';
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }

  watchLocation(callback: (location: Location) => void, errorCallback?: (error: Error) => void): number {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported');
      errorCallback?.(error);
      throw error;
    }

    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        try {
          location.address = await this.reverseGeocode(location.lat, location.lng);
        } catch (error) {
          console.warn('Failed to reverse geocode watched location:', error);
        }

        callback(location);
      },
      (error) => {
        let message = 'Failed to watch location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location timeout';
            break;
        }
        errorCallback?.(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000, // 1 minute
      }
    );

    return this.watchId;
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async searchLocations(query: string): Promise<LocationSearchResult[]> {
    // In a real application, this would integrate with a geocoding service
    // like Google Places API, Mapbox Geocoding, or similar
    
    try {
      // Mock implementation - in production, replace with actual API call
      const mockResults: LocationSearchResult[] = [
        {
          address: `${query} - Times Square, New York, NY`,
          lat: 40.7580 + Math.random() * 0.01,
          lng: -73.9855 + Math.random() * 0.01,
          place_id: 'mock_1'
        },
        {
          address: `${query} - Central Park, New York, NY`,
          lat: 40.7829 + Math.random() * 0.01,
          lng: -73.9654 + Math.random() * 0.01,
          place_id: 'mock_2'
        },
        {
          address: `${query} - Brooklyn Bridge, Brooklyn, NY`,
          lat: 40.7061 + Math.random() * 0.01,
          lng: -73.9969 + Math.random() * 0.01,
          place_id: 'mock_3'
        }
      ];

      // Filter results based on query
      return mockResults.filter(result => 
        result.address.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
    } catch (error) {
      console.error('Failed to search locations:', error);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    // In a real application, this would use a reverse geocoding service
    
    try {
      // Mock implementation - in production, replace with actual API call
      const addresses = [
        '123 Main St, New York, NY 10001',
        '456 Broadway, New York, NY 10013',
        '789 Fifth Ave, New York, NY 10022',
        '321 Park Ave, New York, NY 10016',
        '654 Lexington Ave, New York, NY 10022'
      ];
      
      return addresses[Math.floor(Math.random() * addresses.length)];
    } catch (error) {
      console.error('Failed to reverse geocode:', error);
      return 'Unknown location';
    }
  }

  async getDistanceAndDuration(origin: Location, destination: Location): Promise<{
    distance: string;
    duration: string;
    distanceValue: number; // in meters
    durationValue: number; // in seconds
  }> {
    // In a real application, this would use a routing service
    // like Google Directions API, Mapbox Directions, etc.
    
    try {
      // Calculate rough distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = this.toRad(destination.lat - origin.lat);
      const dLng = this.toRad(destination.lng - origin.lng);
      
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(origin.lat)) * Math.cos(this.toRad(destination.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = R * c;
      
      // Mock duration calculation (assuming average city speed of 25 km/h)
      const durationHours = distanceKm / 25;
      const durationMinutes = Math.round(durationHours * 60);
      
      return {
        distance: `${distanceKm.toFixed(1)} km`,
        duration: `${durationMinutes} min`,
        distanceValue: Math.round(distanceKm * 1000), // convert to meters
        durationValue: durationMinutes * 60, // convert to seconds
      };
    } catch (error) {
      console.error('Failed to calculate distance:', error);
      return {
        distance: '0 km',
        duration: '0 min',
        distanceValue: 0,
        durationValue: 0,
      };
    }
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Validate if coordinates are within reasonable bounds
  isValidLocation(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  // Get popular locations for quick selection
  getPopularLocations(): LocationSearchResult[] {
    return [
      {
        address: 'John F. Kennedy International Airport, Queens, NY',
        lat: 40.6413,
        lng: -73.7781,
        place_id: 'jfk_airport'
      },
      {
        address: 'LaGuardia Airport, Queens, NY',
        lat: 40.7769,
        lng: -73.8740,
        place_id: 'lga_airport'
      },
      {
        address: 'Newark Liberty International Airport, Newark, NJ',
        lat: 40.6895,
        lng: -74.1745,
        place_id: 'ewr_airport'
      },
      {
        address: 'Penn Station, New York, NY',
        lat: 40.7505,
        lng: -73.9934,
        place_id: 'penn_station'
      },
      {
        address: 'Grand Central Terminal, New York, NY',
        lat: 40.7527,
        lng: -73.9772,
        place_id: 'grand_central'
      }
    ];
  }
}

export const locationService = LocationService.getInstance();
