import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { LatLngExpression, Icon, latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconRetinaUrl: markerIcon2x,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle automatic bounds adjustment
function AutoBounds({ routeCoordinates, pickupLat, pickupLng, dropoffLat, dropoffLng }: {
  routeCoordinates: LatLngExpression[];
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates.length > 0) {
      // Create bounds from all route coordinates
      const bounds = routeCoordinates.reduce(
        (bounds, coord) => bounds.extend(coord as [number, number]),
        latLngBounds([[pickupLat, pickupLng], [dropoffLat, dropoffLng]])
      );
      
      // Fit the map to show the entire route with no padding  
      map.fitBounds(bounds, { padding: [0, 0] });
    }
  }, [map, routeCoordinates, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  return null;
}

interface RouteMapProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupLocation: string;
  dropoffLocation: string;
  rideType: string;
  passengerCount: number;
  petCount: number;
  showRoute?: boolean;
  onRouteUpdate?: (distance: number, duration: number, price: number) => void;
}

export default function RouteMap({ 
  pickupLat, 
  pickupLng, 
  dropoffLat, 
  dropoffLng, 
  pickupLocation, 
  dropoffLocation,
  rideType,
  passengerCount,
  petCount,
  showRoute = false,
  onRouteUpdate 
}: RouteMapProps) {
  const [routeCoordinates, setRouteCoordinates] = useState<LatLngExpression[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create custom icons for pickup and dropoff
  const pickupIcon = new Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 15 15 25 15 25s15-10 15-25C30 6.7 23.3 0 15 0z" fill="#22c55e"/>
        <circle cx="15" cy="15" r="8" fill="white"/>
        <text x="15" y="19" text-anchor="middle" fill="#22c55e" font-size="12" font-weight="bold">P</text>
      </svg>
    `),
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40]
  });

  const dropoffIcon = new Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 15 15 25 15 25s15-10 15-25C30 6.7 23.3 0 15 0z" fill="#ef4444"/>
        <circle cx="15" cy="15" r="8" fill="white"/>
        <text x="15" y="19" text-anchor="middle" fill="#ef4444" font-size="12" font-weight="bold">D</text>
      </svg>
    `),
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40]
  });

  // Fetch pricing from Supabase edge function
  const fetchPricing = async (miles: number, minutes: number) => {
    try {
      const requestBody = {
        miles: miles,
        minutes: minutes,
        people: passengerCount,
        pets: petCount,
        rideType: rideType,
        cars: Math.ceil(passengerCount / 4) // Calculate vehicles needed
      };
      
      console.log('Pricing API request:', requestBody);
      
      const response = await fetch('https://vkytupgdapdfpfolsmnd.supabase.co/functions/v1/supabase-functions-YAH_QUOTE_URL-index-ts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pricing API response:', data);
        return data.price || 0;
      } else {
        const errorText = await response.text();
        console.error('Pricing API error:', response.status, errorText);
        return 0;
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      return 0;
    }
  };

  // Fetch real driving route from OSRM API
  const fetchDrivingRoute = async () => {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`;
      

      
      const response = await fetch(osrmUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates;
          
          // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
          const leafletCoordinates = coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as LatLngExpression);
          
          // Reduce coordinate density for better performance (every 10th point)
          const simplifiedCoordinates = leafletCoordinates.filter((_: LatLngExpression, index: number) => index % 10 === 0);
          

          setRouteCoordinates(simplifiedCoordinates);
          
          // Use OSRM's distance and duration data
          const distanceKm = route.distance / 1000; // Convert from meters to km
          const distanceMiles = distanceKm * 0.621371; // Convert to miles
          const durationMinutes = Math.round(route.duration / 60); // Convert from seconds to minutes
          
          console.log('OSRM Route data:', {
            distance: distanceKm,
            distanceMiles,
            duration: durationMinutes
          });
          
          return { distance: distanceMiles, duration: durationMinutes };
        }
      }
      
      throw new Error('Failed to fetch driving route');
    } catch (error) {
      console.error('Error fetching driving route from OSRM:', error);
      
      // Fallback to simple calculation
      const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      const duration = Math.round(distance * 60 / 25);
      
      // Create simple curved route as fallback
      const routePoints = calculateSimpleRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);
      setRouteCoordinates(routePoints);
      
      return { distance, duration };
    }
  };

  // Fetch driving route and calculate pricing
  const fetchRoute = async () => {
    setIsLoading(true);
    try {
      // Get real driving route from OSRM
      const { distance, duration } = await fetchDrivingRoute();
      
      // Fetch real pricing from Supabase edge function
      const price = await fetchPricing(distance, duration);
      
      if (onRouteUpdate) {
        onRouteUpdate(distance, duration, price);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback to simple straight line
      setRouteCoordinates([
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng]
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate a simple curved route between two points
  const calculateSimpleRoute = (lat1: number, lng1: number, lat2: number, lng2: number): LatLngExpression[] => {
    const points: LatLngExpression[] = [];
    const steps = 20;
    
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      
      // Create a slight curve for more realistic route appearance
      const latDiff = lat2 - lat1;
      const lngDiff = lng2 - lng1;
      
      // Add some curve to make it look like a real route
      const curveFactor = Math.sin(ratio * Math.PI) * 0.1;
      
      const lat = lat1 + (latDiff * ratio) + (curveFactor * latDiff * 0.2);
      const lng = lng1 + (lngDiff * ratio) + (curveFactor * lngDiff * 0.1);
      
      points.push([lat, lng]);
    }
    
    return points;
  };

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate map center and bounds
  const centerLat = (pickupLat + dropoffLat) / 2;
  const centerLng = (pickupLng + dropoffLng) / 2;
  const center: LatLngExpression = [centerLat, centerLng];

  // Calculate zoom level based on distance
  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const getZoomLevel = (dist: number): number => {
    if (dist < 5) return 12;
    if (dist < 25) return 10;
    if (dist < 100) return 8;
    if (dist < 500) return 6;
    return 4;
  };

  useEffect(() => {
    if (pickupLat && pickupLng && dropoffLat && dropoffLng && showRoute) {
      fetchRoute();
    } else if (!showRoute) {
      // Clear route coordinates when route is not being shown
      setRouteCoordinates([]);
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, showRoute]);

  return (
    <div className="relative">
      <MapContainer
        center={center}
        zoom={getZoomLevel(distance)}
        style={{ height: '480px', width: '100%' }}
        className="rounded-lg z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Pickup Marker */}
        <Marker position={[pickupLat, pickupLng]} icon={pickupIcon}>
          <Popup>
            <div className="text-sm">
              <strong>Pickup Location</strong><br />
              {pickupLocation.split(',').slice(0, 2).join(', ')}
            </div>
          </Popup>
        </Marker>
        
        {/* Dropoff Marker */}
        <Marker position={[dropoffLat, dropoffLng]} icon={dropoffIcon}>
          <Popup>
            <div className="text-sm">
              <strong>Drop-off Location</strong><br />
              {dropoffLocation.split(',').slice(0, 2).join(', ')}
            </div>
          </Popup>
        </Marker>
        
        {/* Driving Route Line - Only show when route is requested */}
        {showRoute && routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8,
              lineJoin: 'round',
              lineCap: 'round'
            }}
          />
        )}
        
        {/* Auto-adjust map bounds when route is shown */}
        {showRoute && (
          <AutoBounds 
            routeCoordinates={routeCoordinates}
            pickupLat={pickupLat}
            pickupLng={pickupLng}
            dropoffLat={dropoffLat}
            dropoffLng={dropoffLng}
          />
        )}

      </MapContainer>
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-20">
          <div className="bg-white rounded-lg p-4 flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-700">Calculating route...</span>
          </div>
        </div>
      )}
    </div>
  );
}