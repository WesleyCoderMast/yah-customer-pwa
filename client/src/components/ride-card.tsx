import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Ride } from "@shared/schema";

interface RideCardProps {
  ride: Ride;
  isActive: boolean;
}

export default function RideCard({ ride, isActive }: RideCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'searching_driver':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'accepted':
        return 'bg-blue-500/20 text-blue-400';
      case 'driver_assigned':
      case 'driver_arriving':
        return 'bg-blue-500/20 text-blue-400';
      case 'driver_arrived':
      case 'in_progress':
        return 'bg-green-500/20 text-green-400';
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'searching_driver':
        return 'fa-search';
      case 'accepted':
        return 'fa-user-check';
      case 'driver_assigned':
        return 'fa-user-check';
      case 'driver_arriving':
        return 'fa-route';
      case 'driver_arrived':
        return 'fa-hand-paper';
      case 'in_progress':
        return 'fa-car';
      case 'completed':
        return 'fa-check-circle';
      case 'cancelled':
        return 'fa-times-circle';
      default:
        return 'fa-clock';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return { date: 'Unknown', time: 'Unknown' };
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return {
      date: dateObj.toLocaleDateString(),
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getDriverPreferenceText = (preferenceId: number | null) => {
    switch (preferenceId) {
      case 1:
        return 'Female drivers only';
      case 2:
        return 'Male drivers only';
      case 3:
        return 'Deaf or hard-of-hearing drivers only';
      case 4:
        return 'Hearing drivers only';
      case 5:
        return 'Drivers comfortable with disabilities';
      case 6:
      default:
        return 'No preference';
    }
  };

  const getDriverPreferenceIcon = (preferenceId: number | null) => {
    switch (preferenceId) {
      case 1:
        return 'fa-venus'; // Female symbol
      case 2:
        return 'fa-mars'; // Male symbol
      case 3:
        return 'fa-hand-paper'; // Sign language
      case 4:
        return 'fa-ear-listen'; // Hearing
      case 5:
        return 'fa-wheelchair'; // Accessibility
      case 6:
      default:
        return 'fa-user-check'; // General/any driver
    }
  };

  const { date, time } = formatDate(ride.created_at);

  return (
    <Card className="glass border-yah-gold/20 card-hover" data-testid={`ride-card-${ride.id}`}>
      <CardContent className="p-5">
        {/* Status and Fare Row */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col space-y-2">
            <Badge className={cn("text-sm font-semibold px-3 py-1", getStatusColor(ride.status))}>
              <i className={`fas ${getStatusIcon(ride.status)} mr-1.5`}></i>
              {ride.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-sm text-yah-gold border-yah-gold/30 px-3 py-1">
              {ride.ride_type}
            </Badge>
            {ride.ride_scope && (
              <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30 px-2 py-1">
                <i className="fas fa-map-marker-alt mr-1"></i>
                {ride.ride_scope}
              </Badge>
            )}
          </div>
          <div className="text-right">
            <p className="font-bold text-xl text-yah-gold">
              ${parseFloat(String(ride.total_fare || '0')).toFixed(2)}
            </p>
            <p className="text-sm text-gray-400">{date}</p>
            <p className="text-sm text-gray-400">{time}</p>
          </div>
        </div>

        {/* Trip Route */}
        <div className="mb-4">
          <div className="grid grid-cols-[20px_1fr] gap-x-4">
            <div className="flex flex-col items-center pt-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="w-0.5 flex-1 bg-gray-500 my-2"></div>
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            <div className="flex flex-col justify-between min-h-[64px]">
              <div className="pb-2">
                <p className="font-semibold text-base text-green-400 mb-1 leading-none">From</p>
                <p className="text-base text-gray-300 leading-relaxed">{ride.pickup}</p>
              </div>
              <div className="pt-2">
                <p className="font-semibold text-base text-red-400 mb-1 leading-none">To</p>
                <p className="text-base text-gray-300 leading-relaxed">{ride.dropoff}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-3 mb-4">
          {/* First row - Passengers, Pets, Duration */}
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <i className="fas fa-users mr-2 text-base"></i>
                <span>{ride.rider_count || 1} passenger{(ride.rider_count || 1) > 1 ? 's' : ''}</span>
              </div>
              {(ride.pet_count || 0) > 0 && (
                <div className="flex items-center">
                  <i className="fas fa-paw mr-2 text-base"></i>
                  <span>{ride.pet_count} pet{(ride.pet_count || 0) > 1 ? 's' : ''}</span>
                </div>
              )}
              {ride.duration_minutes && (
                <div className="flex items-center">
                  <i className="fas fa-clock mr-2 text-base"></i>
                  <span>{Math.round(ride.duration_minutes)} min</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Second row - Driver Preference */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center flex-shrink-0">
              <i className={`fas ${getDriverPreferenceIcon(ride.person_preference_id)} mr-2 text-base text-yah-gold`}></i>
              <span className="text-sm text-gray-300 font-medium">Driver:</span>
            </div>
            <span className="text-sm text-gray-300 text-right flex-1 min-w-0">
              {getDriverPreferenceText(ride.person_preference_id)}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex space-x-2">
          {isActive ? (
            <Link href={`/ride/${ride.id}`} className="flex-1">
              <Button 
                className="w-full bg-gradient-gold text-yah-darker font-semibold ripple h-12 text-base"
                data-testid={`button-trackRide-${ride.id}`}
              >
                <i className="fas fa-eye mr-2 text-lg"></i>
                Track Ride
              </Button>
            </Link>
          ) : (
            <Link href={`/ride/${ride.id}`} className="flex-1">
              <Button 
                variant="outline" 
                className="w-full border-yah-gold/30 text-yah-gold hover:bg-yah-gold/20 h-12 text-base"
                data-testid={`button-viewDetails-${ride.id}`}
              >
                <i className="fas fa-receipt mr-2 text-lg"></i>
                View Details
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
