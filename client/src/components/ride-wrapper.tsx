import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import RideTracking from "@/pages/ride-tracking";
import RideDetail from "@/pages/ride-detail";

export default function RideWrapper() {
  const [match, params] = useRoute("/ride/:rideId");

  const { data: rideData, isLoading } = useQuery({
    queryKey: ['/api/rides', params?.rideId || ''],
    queryFn: () => apiRequest('GET', `/api/rides/${params?.rideId}`).then(res => res.json()),
    enabled: !!params?.rideId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <i className="fas fa-car text-primary-foreground text-2xl"></i>
          </div>
          <p className="text-primary font-semibold">Loading ride...</p>
        </div>
      </div>
    );
  }

  const ride = (rideData as any)?.ride;
  
  if (!ride) {
    return <RideDetail />; // Let RideDetail handle the error state
  }

  // Show tracking view for active rides
  const activeStatuses = ['pending', 'searching_driver', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'accepted', 'in_progress'];
  if (activeStatuses.includes(ride.status)) {
    return <RideTracking />;
  }

  // Show detail view for completed/cancelled rides
  return <RideDetail />;
}
