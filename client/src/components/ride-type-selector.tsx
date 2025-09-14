import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RideType } from "@shared/schema";

interface RideTypeSelectorProps {
  selectedRideType: string;
  onRideTypeChange: (rideType: string) => void;
  tripArea: 'in-city' | 'out-of-city';
  selectedCategory?: string; // Selected category from step 2
  className?: string;
}

// Helper function to determine trip area from ride type title
const getTripAreaFromRideType = (title: string): 'in-city' | 'out-of-city' => {
  return title.toLowerCase().includes('travel') ? 'out-of-city' : 'in-city';
};

const getInCityCategories = () => [
  { id: 'regular', name: 'Regular Rides', icon: 'fa-car-side', description: 'Standard rides' },
  { id: 'individual', name: 'Individual Rides', icon: 'fa-user', description: 'Personal service' },
  { id: 'relationship', name: 'Relationship Rides', icon: 'fa-heart', description: 'Special connections' },
  { id: 'event', name: 'Event Rides', icon: 'fa-star', description: 'Special occasions' },
  { id: 'protected', name: 'Protected Rides', icon: 'fa-shield-alt', description: 'Secure service' },
  { id: 'luxury', name: 'Luxury Rides', icon: 'fa-crown', description: 'Premium experience' },
  { id: 'service', name: 'Service Rides', icon: 'fa-briefcase', description: 'Professional needs' },
];

const getOutOfCityCategories = () => [
  { id: 'travel-basic', name: 'Travel – Basic', icon: 'fa-plane', description: 'Standard travel' },
  { id: 'travel-individual', name: 'Travel – Individual', icon: 'fa-user-friends', description: 'Personal travel' },
  { id: 'travel-group', name: 'Travel – Group', icon: 'fa-users', description: 'Group travel' },
  { id: 'travel-purpose', name: 'Travel – Purpose', icon: 'fa-briefcase', description: 'Business/medical' },
  { id: 'travel-relationship', name: 'Travel – Relationship', icon: 'fa-heart', description: 'Special occasions' },
  { id: 'travel-protected', name: 'Travel – Protected', icon: 'fa-shield-alt', description: 'Secure travel' },
  { id: 'travel-luxury', name: 'Travel – Luxury', icon: 'fa-crown', description: 'Premium travel' },
  { id: 'travel-quiet', name: 'Travel – Quiet', icon: 'fa-volume-mute', description: 'Silent journey' },
];

export default function RideTypeSelector({ selectedRideType, onRideTypeChange, tripArea, selectedCategory, className }: RideTypeSelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(selectedCategory || (tripArea === 'in-city' ? 'regular' : 'travel-basic'));
  
  // Auto-expand the selected category
  useEffect(() => {
    if (selectedCategory) {
      setExpandedCategory(selectedCategory);
    }
  }, [selectedCategory]);

  // Fetch ride types from database
  const { data: rideTypesResponse, isLoading, error } = useQuery({
    queryKey: ['/api/ride-types'],
    queryFn: () => fetch('/api/ride-types').then(res => res.json()),
  });

  const rideTypes = rideTypesResponse?.rideTypes || [];

  // Filter ride types by trip area
  const filteredRideTypes = rideTypes.filter((rideType: RideType) => 
    getTripAreaFromRideType(rideType.title) === tripArea
  );
  
  const groupedRideTypes = filteredRideTypes.reduce((acc: Record<string, RideType[]>, rideType: RideType) => {
    // Extract category from title since database doesn't have category field yet
    let category = 'regular';
    const title = rideType.title.toLowerCase();
    
    if (title.includes('travel')) {
      if (title.includes('individual')) category = 'travel-individual';
      else if (title.includes('group') || title.includes('family')) category = 'travel-group';
      else if (title.includes('business') || title.includes('medical')) category = 'travel-purpose';
      else if (title.includes('engagement') || title.includes('union') || title.includes('marriage') || title.includes('honeymoon')) category = 'travel-relationship';
      else if (title.includes('army') || title.includes('military') || title.includes('security')) category = 'travel-protected';
      else if (title.includes('royal') || title.includes('celebrity') || title.includes('elite')) category = 'travel-luxury';
      else if (title.includes('quiet') || title.includes('silent')) category = 'travel-quiet';
      else category = 'travel-basic';
    } else {
      if (title.includes('youth') || title.includes('man') || title.includes('woman') || title.includes('senior') || title.includes('single') || title.includes('solo')) category = 'individual';
      else if (title.includes('couple') || title.includes('engagement') || title.includes('union') || title.includes('dating') || title.includes('marriage') || title.includes('wedding') || title.includes('match') || title.includes('pure')) category = 'relationship';
      else if (title.includes('birthday') || title.includes('valentine') || title.includes('party') || title.includes('invitation')) category = 'event';
      else if (title.includes('army') || title.includes('military') || title.includes('security')) category = 'protected';
      else if (title.includes('royal') || title.includes('celebrity') || title.includes('elite')) category = 'luxury';
      else if (title.includes('business') || title.includes('medical')) category = 'service';
    }
    
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(rideType);
    return acc;
  }, {} as Record<string, RideType[]>);
  
  // Filter categories based on selected category from step 2
  const allCategories = tripArea === 'in-city' ? getInCityCategories() : getOutOfCityCategories();
  const availableCategories = selectedCategory 
    ? allCategories.filter(cat => cat.id === selectedCategory)
    : allCategories;

  const categoryLabels = {
    regular: 'Regular Rides',
    individual: 'Individual Rides',
    relationship: 'Relationship Rides',
    event: 'Event Rides',
    protected: 'Protected Rides',
    luxury: 'Luxury Rides',
    service: 'Service Rides',
    'travel-basic': 'Travel – Basic',
    'travel-individual': 'Travel – Individual',
    'travel-group': 'Travel – Group',
    'travel-purpose': 'Travel – Purpose',
    'travel-relationship': 'Travel – Relationship',
    'travel-protected': 'Travel – Protected',
    'travel-luxury': 'Travel – Luxury',
    'travel-quiet': 'Travel – Quiet'
  };

  const categoryIcons = {
    regular: 'fa-car-side',
    individual: 'fa-user',
    relationship: 'fa-heart',
    event: 'fa-star',
    protected: 'fa-shield-alt',
    luxury: 'fa-crown',
    service: 'fa-briefcase',
    'travel-basic': 'fa-plane',
    'travel-individual': 'fa-user-friends',
    'travel-group': 'fa-users',
    'travel-purpose': 'fa-briefcase',
    'travel-relationship': 'fa-heart',
    'travel-protected': 'fa-shield-alt',
    'travel-luxury': 'fa-crown',
    'travel-quiet': 'fa-volume-mute'
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <i className="fas fa-car text-yah-gold mr-2"></i>
          {tripArea === 'in-city' ? 'Choose a Ride Category' : 'Choose a Travel Category'}
        </h3>
        <div className="text-center py-8">
          <i className="fas fa-spinner fa-spin text-yah-gold text-2xl mb-4"></i>
          <p className="text-gray-300">Loading ride types...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <i className="fas fa-car text-yah-gold mr-2"></i>
          {tripArea === 'in-city' ? 'Choose a Ride Category' : 'Choose a Travel Category'}
        </h3>
        <div className="text-center py-8">
          <i className="fas fa-exclamation-triangle text-red-500 text-2xl mb-4"></i>
          <p className="text-gray-300">Failed to load ride types. Please try again.</p>
        </div>
      </div>
    );
  }

  const getHeaderText = () => {
    if (selectedCategory) {
      const categoryInfo = availableCategories.find(cat => cat.id === selectedCategory);
      return categoryInfo ? categoryInfo.name : 'Choose a Ride Type';
    }
    return tripArea === 'in-city' ? 'Choose a Ride Category' : 'Choose a Travel Category';
  };

  const getDescriptionText = () => {
    if (selectedCategory) {
      return 'Choose the specific service that meets your needs.';
    }
    return tripArea === 'in-city' 
      ? 'Choose In-City for local rides. Tap on categories below to see available ride types.'
      : 'Choose Out-of-City/Out-of-State for longer trips. Tap on categories below to see available ride types.';
  };

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-car text-yah-gold mr-2"></i>
        {getHeaderText()}
      </h3>

      {/* Description */}
      <div className="text-sm text-gray-300 mb-4 p-3 bg-yah-darker/50 rounded-lg">
        <p>{getDescriptionText()}</p>
      </div>

      {/* Available Categories */}
      <div className="space-y-3">
        {availableCategories.map((category) => {
          const rides = groupedRideTypes[category.id] || [];
          if (rides.length === 0) return null;
          
          return (
            <Card 
              key={category.id} 
              className="glass border-yah-gold/20 card-hover"
            >
              <CardContent className="p-4">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                  className="w-full flex items-center justify-between mb-3 text-left"
                  data-testid={`category-toggle-${category.id}`}
                >
                  <h4 className="font-semibold text-yah-gold flex items-center">
                    <i className={`fas ${category.icon} mr-2`}></i>
                    {category.name}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {rides.length}
                    </Badge>
                  </h4>
                  <i className={`fas fa-chevron-${expandedCategory === category.id ? 'up' : 'down'} text-gray-400`}></i>
                </button>

                {expandedCategory === category.id && (
                  <div className="grid grid-cols-1 gap-2">
                    {rides.map((rideType: RideType) => (
                      <button
                        key={rideType.id.toString()}
                        onClick={() => onRideTypeChange(rideType.title)}
                        className={cn(
                          "p-3 rounded-lg transition-all duration-200 text-sm relative text-left",
                          selectedRideType === rideType.title
                            ? "bg-gradient-gold text-yah-darker font-semibold shadow-lg"
                            : "bg-yah-darker/80 hover:bg-yah-gold/20 text-white"
                        )}
                        data-testid={`ride-type-${rideType.id.toString()}`}
                      >
                        <div className="flex items-center">
                          <i className={`fas fa-car mr-3 text-lg`}></i>
                          <div className="flex-1">
                            <p className="font-medium">{rideType.title}</p>
                            <p className="text-xs opacity-80 mt-1">{rideType.description}</p>
                            {rideType.requireDoor && (
                              <p className="text-xs mt-1 text-blue-300">
                                <i className="fas fa-door-open mr-1"></i>
                                Open Door Available
                              </p>
                            )}
                          </div>
                          {rideType.vipOnly && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs bg-yah-gold text-yah-dark ml-2"
                            >
                              ✨ Premium
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
