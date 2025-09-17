import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RideType, RideCategory } from "@shared/schema";
import { VITE_API_BASE_URL } from "@/lib/config";

interface RideTypeSelectorProps {
  selectedRideType: string;
  onRideTypeChange: (rideType: string, rideTypeId: string) => void;
  tripArea: 'in-city' | 'out-of-city';
  selectedCategory?: string; // Selected category from step 2
  categories?: RideCategory[]; // Real categories from database
  className?: string;
}

// Helper function to determine trip area from ride type title
const getTripAreaFromRideType = (title: string): 'in-city' | 'out-of-city' => {
  return title.toLowerCase().includes('travel') ? 'out-of-city' : 'in-city';
};


export default function RideTypeSelector({ selectedRideType, onRideTypeChange, tripArea, selectedCategory, categories, className }: RideTypeSelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(selectedCategory || null);

  // Helper function to get icon for ride type
  const getRideTypeIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('luxury') || t.includes('premium') || t.includes('vip')) return 'fa-crown';
    if (t.includes('family') || t.includes('group')) return 'fa-users';
    if (t.includes('business') || t.includes('corporate')) return 'fa-briefcase';
    if (t.includes('medical') || t.includes('health')) return 'fa-ambulance';
    if (t.includes('wedding') || t.includes('marriage')) return 'fa-heart';
    if (t.includes('airport') || t.includes('travel')) return 'fa-plane';
    if (t.includes('event') || t.includes('party')) return 'fa-calendar';
    if (t.includes('pet') || t.includes('animal')) return 'fa-paw';
    if (t.includes('wheelchair') || t.includes('accessibility')) return 'fa-wheelchair';
    return 'fa-car'; // Default icon
  };
  
  // Auto-expand the selected category
  useEffect(() => {
    if (selectedCategory) {
      setExpandedCategory(selectedCategory);
    }
  }, [selectedCategory]);

  // Fetch ride types from database based on selected category
  const { data: rideTypesResponse, isLoading, error } = useQuery({
    queryKey: ['/api/ride-types/by-category', selectedCategory, tripArea],
    queryFn: () => {
      if (!selectedCategory) return { rideTypes: [] };
      console.log('Fetching ride types for categoryId:', selectedCategory, 'tripArea:', tripArea);
      return fetch(`${VITE_API_BASE_URL}/api/ride-types/by-category?categoryId=${selectedCategory}&tripArea=${tripArea}`).then(res => res.json());
    },
    enabled: !!selectedCategory, // Only fetch when a category is selected
  });

  const rideTypes = rideTypesResponse?.rideTypes || [];
  console.log('Received ride types:', rideTypes.length, 'for categoryId:', selectedCategory);

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
  const allCategories = categories ? categories.filter(cat => {
    if (tripArea === 'in-city') {
      return cat.scope === 'In-City' || cat.scope === 'in-city';
    } else {
      return cat.scope === 'Out-of-City / Out-of-State / Travel' || 
             cat.scope === 'out-of-city' || 
             cat.scope === 'travel';
    }
  }) : [];
  
  const availableCategories = selectedCategory 
    ? allCategories.filter(cat => cat.id === selectedCategory)
    : allCategories;


  // Show loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-xl font-bold mb-4 flex items-center text-white">
          <i className="fas fa-car text-yah-gold mr-3 text-lg"></i>
          {tripArea === 'in-city' ? 'Choose a Ride Category' : 'Choose a Travel Category'}
        </h3>
        <div className="text-center py-12">
          <i className="fas fa-spinner fa-spin text-yah-gold text-3xl mb-4"></i>
          <p className="text-gray-400 text-lg">Loading ride types...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-xl font-bold mb-4 flex items-center text-white">
          <i className="fas fa-car text-yah-gold mr-3 text-lg"></i>
          {tripArea === 'in-city' ? 'Choose a Ride Category' : 'Choose a Travel Category'}
        </h3>
        <div className="text-center py-12">
          <i className="fas fa-exclamation-triangle text-red-400 text-3xl mb-4"></i>
          <p className="text-gray-400 text-lg">Failed to load ride types. Please try again.</p>
        </div>
      </div>
    );
  }

  // Show message if no categories are available
  if (!categories || categories.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-xl font-bold mb-4 flex items-center text-white">
          <i className="fas fa-car text-yah-gold mr-3 text-lg"></i>
          {tripArea === 'in-city' ? 'Choose a Ride Category' : 'Choose a Travel Category'}
        </h3>
        <div className="text-center py-12">
          <i className="fas fa-info-circle text-blue-400 text-3xl mb-4"></i>
          <p className="text-gray-400 text-lg">No categories available for this trip area.</p>
        </div>
      </div>
    );
  }

  // If a category is selected, show ride types for that category
  if (selectedCategory) {
    // Map ride types to display format
    const rideTypeOptions = filteredRideTypes.map((rideType: RideType) => ({
      id: rideType.id.toString(),
      title: rideType.title,
      description: rideType.description || '',
      icon: getRideTypeIcon(rideType.title),
      price: rideType.pricePerMin ? `$${rideType.pricePerMin}/min` : 'Price on request',
      features: [
        `Max ${rideType.maxPassengers} passengers`,
        rideType.requiresPet ? 'Pet-friendly' : 'No pets',
        rideType.isFamilyFriendly ? 'Family-friendly' : 'Adults only',
        rideType.vipOnly ? 'VIP only' : 'Available to all',
      ].filter(Boolean),
    }));

    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-xl font-bold mb-4 flex items-center text-white">
          <i className="fas fa-car text-yah-gold mr-3 text-lg"></i>
          Choose a Ride Type
        </h3>

        {/* Description */}
        <div className="text-sm text-gray-400 mb-6 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
          <p>Choose the specific service that meets your needs.</p>
        </div>

        {/* Show message if no ride types available */}
        {rideTypeOptions.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-info-circle text-blue-400 text-3xl mb-4"></i>
            <p className="text-gray-400 text-lg">No ride types available for this category.</p>
          </div>
        ) : (
          /* Ride Type Options */
          <div className="space-y-4">
            {rideTypeOptions.map((option: any) => (
              <Card 
                key={option.id} 
                className={cn(
                  "transition-all duration-300 cursor-pointer group",
                  selectedRideType === option.title 
                    ? "bg-gradient-to-r from-yah-gold/20 to-yah-gold/10 border-yah-gold shadow-lg shadow-yah-gold/20" 
                    : "bg-slate-800/80 border-slate-700 hover:bg-slate-700/80 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/20"
                )}
              >
                <CardContent className="p-5">
                  <button
                    onClick={() => onRideTypeChange(option.title, option.id)}
                    className="w-full text-left"
                    data-testid={`ride-type-${option.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center mr-4 transition-colors",
                          selectedRideType === option.title 
                            ? "bg-yah-gold text-white" 
                            : "bg-slate-700 text-yah-gold group-hover:bg-yah-gold/20"
                        )}>
                          <i className={`fas ${option.icon} text-lg`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={cn(
                            "font-bold text-lg mb-1 transition-colors",
                            selectedRideType === option.title 
                              ? "text-white" 
                              : "text-gray-200 group-hover:text-white"
                          )}>
                            {option.title}
                          </h4>
                          <p className={cn(
                            "text-sm transition-colors",
                            selectedRideType === option.title 
                              ? "text-gray-300" 
                              : "text-gray-400 group-hover:text-gray-300"
                          )}>
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const getHeaderText = () => {
    if (selectedCategory) {
      const categoryInfo = availableCategories.find(cat => cat.id === selectedCategory);
      return categoryInfo ? categoryInfo.category_name : 'Choose a Ride Type';
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
                    <i className="fas fa-car mr-2"></i>
                    {category.category_name}
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
                        onClick={() => onRideTypeChange(rideType.title, rideType.id.toString())}
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
