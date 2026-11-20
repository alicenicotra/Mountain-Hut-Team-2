// MH-139 hike API contract
export interface Hike {
  id: number;
  userId: number;
  departureAt: string;
  expectedReturnAt: string; 
  destination: string;
  routeDescription: string;
  intermediatePoints: string[];
  emergencyContactPhone: string | null;
  createdAt: string;
}

export interface RegisterHikeRequest {
  departureAt: string;
  expectedReturnAt: string;
  destination: string;
  routeDescription: string;
  intermediatePoints?: string[];
  emergencyContactPhone?: string;
}