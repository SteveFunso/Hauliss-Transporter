export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'admin' | 'fleet_manager' | 'support';
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  lastActive: string;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended' | 'in_transit';
  rating: number;
  totalTrips: number;
  earnings: number;
  vehicleId?: string;
  createdAt: string;
  documents: {
    license: DocumentStatus;
    identity: DocumentStatus;
    address: DocumentStatus;
  };
}

export interface Truck {
  id: string;
  plateNumber: string;
  type: 'flatbed' | 'box_truck' | 'tanker' | 'tipper' | 'refrigerated';
  capacity: number;
  capacityUnit: 'kg' | 'tons';
  status: 'available' | 'in_transit' | 'maintenance' | 'offline';
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  driverId?: string;
  owner: 'company' | 'owner_operator';
  model: string;
  year: number;
  mileage: number;
  documents: {
    insurance: DocumentStatus;
    registration: DocumentStatus;
    fitness: DocumentStatus;
  };
  createdAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  driverId?: string;
  truckId?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  pickup: {
    address: string;
    lat: number;
    lng: number;
    time: string;
  };
  dropoff: {
    address: string;
    lat: number;
    lng: number;
    time: string;
  };
  cargo: {
    type: string;
    weight: number;
    description: string;
  };
  price: number;
  distance: number;
  duration: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: 'trip_payment' | 'wallet_topup' | 'withdrawal' | 'commission' | 'refund';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  fromUserId: string;
  toUserId?: string;
  bookingId?: string;
  method: 'card' | 'bank_transfer' | 'wallet' | 'cash';
  reference: string;
  createdAt: string;
  completedAt?: string;
}

export interface Wallet {
  userId: string;
  balance: number;
  currency: string;
  status: 'active' | 'frozen';
  transactions: Transaction[];
}

export interface PricingConfig {
  id: string;
  name: string;
  basePrice: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  surgeMultiplier: number;
  truckType: string;
  active: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  type: 'general' | 'payment' | 'trip' | 'driver' | 'technical';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  responses: TicketResponse[];
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  createdAt: string;
}

export type DocumentStatus = {
  status: 'pending' | 'approved' | 'rejected';
  url?: string;
  verifiedAt?: string;
  verifiedBy?: string;
};

export interface DashboardStats {
  totalUsers: number;
  totalDrivers: number;
  totalTrucks: number;
  activeBookings: number;
  completedTrips: number;
  totalRevenue: number;
  avgRating: number;
  activeDrivers: number;
}

export interface ChartData {
  name: string;
  value?: number;
  revenue?: number;
  trips?: number;
  color?: string;
  [key: string]: any;
}
