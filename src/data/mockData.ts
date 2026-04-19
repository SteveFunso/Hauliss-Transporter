import type { 
  User, 
  Driver, 
  Truck, 
  Booking, 
  Transaction, 
  PricingConfig, 
  SupportTicket,
  DashboardStats,
  ChartData 
} from '@/types';

export const dashboardStats: DashboardStats = {
  totalUsers: 2847,
  totalDrivers: 1253,
  totalTrucks: 958,
  activeBookings: 423,
  completedTrips: 15689,
  totalRevenue: 285000000,
  avgRating: 4.8,
  activeDrivers: 742
};

export const users: User[] = [
  {
    id: 'usr_001',
    name: 'Adebayo Oluwaseun',
    email: 'adebayo@swiftcargo.ng',
    phone: '+234 802 123 4567',
    avatar: '/avatar-1.jpg',
    role: 'fleet_manager',
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    lastActive: '2024-01-25T14:20:00Z'
  },
  {
    id: 'usr_002',
    name: 'Chiamaka Nwosu',
    email: 'chiamaka@logisticspro.ng',
    phone: '+234 803 987 6543',
    avatar: '/avatar-2.jpg',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-10T09:15:00Z',
    lastActive: '2024-01-25T16:45:00Z'
  },
  {
    id: 'usr_003',
    name: 'Emeka Okonkwo',
    email: 'emeka@freightmasters.ng',
    phone: '+234 805 456 7890',
    avatar: '/avatar-3.jpg',
    role: 'support',
    status: 'active',
    createdAt: '2023-12-20T11:00:00Z',
    lastActive: '2024-01-24T18:30:00Z'
  }
];

export const drivers: Driver[] = [
  {
    id: 'drv_001',
    name: 'Ibrahim Musa',
    email: 'ibrahim.musa@truckq.ng',
    phone: '+234 806 111 2222',
    avatar: '/avatar-1.jpg',
    licenseNumber: 'DRV123456789',
    licenseExpiry: '2025-08-15',
    status: 'active',
    rating: 4.9,
    totalTrips: 342,
    earnings: 2850000,
    vehicleId: 'trk_001',
    createdAt: '2023-06-15T10:00:00Z',
    documents: {
      license: { status: 'approved', verifiedAt: '2023-06-15T10:00:00Z' },
      identity: { status: 'approved', verifiedAt: '2023-06-15T10:00:00Z' },
      address: { status: 'approved', verifiedAt: '2023-06-15T10:00:00Z' }
    }
  },
  {
    id: 'drv_002',
    name: 'Tunde Afolayan',
    email: 'tunde.afolayan@truckq.ng',
    phone: '+234 807 333 4444',
    avatar: '/avatar-2.jpg',
    licenseNumber: 'DRV987654321',
    licenseExpiry: '2025-12-20',
    status: 'in_transit',
    rating: 4.7,
    totalTrips: 189,
    earnings: 1680000,
    vehicleId: 'trk_002',
    createdAt: '2023-09-10T14:30:00Z',
    documents: {
      license: { status: 'approved', verifiedAt: '2023-09-10T14:30:00Z' },
      identity: { status: 'approved', verifiedAt: '2023-09-10T14:30:00Z' },
      address: { status: 'pending' }
    }
  },
  {
    id: 'drv_003',
    name: 'Yusuf Bello',
    email: 'yusuf.bello@truckq.ng',
    phone: '+234 808 555 6666',
    avatar: '/avatar-3.jpg',
    licenseNumber: 'DRV555666777',
    licenseExpiry: '2026-03-10',
    status: 'pending',
    rating: 0,
    totalTrips: 0,
    earnings: 0,
    createdAt: '2024-01-20T09:00:00Z',
    documents: {
      license: { status: 'pending' },
      identity: { status: 'rejected', verifiedAt: '2024-01-21T10:00:00Z' },
      address: { status: 'pending' }
    }
  }
];

export const trucks: Truck[] = [
  {
    id: 'trk_001',
    plateNumber: 'LAGOS-AB123CD',
    type: 'flatbed',
    capacity: 25,
    capacityUnit: 'tons',
    status: 'in_transit',
    location: {
      lat: 6.5244,
      lng: 3.3792,
      address: 'Oshodi-Apapa Expressway, Lagos'
    },
    driverId: 'drv_001',
    owner: 'company',
    model: 'Mercedes Actros',
    year: 2020,
    mileage: 125000,
    documents: {
      insurance: { status: 'approved', verifiedAt: '2024-01-10T10:00:00Z' },
      registration: { status: 'approved', verifiedAt: '2023-05-20T10:00:00Z' },
      fitness: { status: 'approved', verifiedAt: '2024-01-05T10:00:00Z' }
    },
    createdAt: '2023-05-20T10:00:00Z'
  },
  {
    id: 'trk_002',
    plateNumber: 'LAGOS-EF456GH',
    type: 'box_truck',
    capacity: 15,
    capacityUnit: 'tons',
    status: 'available',
    location: {
      lat: 6.4471,
      lng: 3.2808,
      address: 'Ikeja, Lagos'
    },
    driverId: 'drv_002',
    owner: 'owner_operator',
    model: 'Volvo FH',
    year: 2019,
    mileage: 98000,
    documents: {
      insurance: { status: 'approved', verifiedAt: '2024-01-15T10:00:00Z' },
      registration: { status: 'approved', verifiedAt: '2023-08-10T10:00:00Z' },
      fitness: { status: 'pending' }
    },
    createdAt: '2023-08-10T10:00:00Z'
  },
  {
    id: 'trk_003',
    plateNumber: 'LAGOS-IJ789KL',
    type: 'tipper',
    capacity: 30,
    capacityUnit: 'tons',
    status: 'maintenance',
    location: {
      lat: 6.5500,
      lng: 3.3667,
      address: 'Oshodi, Lagos'
    },
    owner: 'company',
    model: 'MAN TGS',
    year: 2018,
    mileage: 156000,
    documents: {
      insurance: { status: 'approved', verifiedAt: '2024-01-01T10:00:00Z' },
      registration: { status: 'approved', verifiedAt: '2023-03-15T10:00:00Z' },
      fitness: { status: 'rejected', verifiedAt: '2024-01-20T10:00:00Z' }
    },
    createdAt: '2023-03-15T10:00:00Z'
  }
];

export const bookings: Booking[] = [
  {
    id: 'bkg_001',
    userId: 'usr_001',
    driverId: 'drv_001',
    truckId: 'trk_001',
    status: 'in_progress',
    pickup: {
      address: 'Oshodi Market, Lagos',
      lat: 6.5075,
      lng: 3.3085,
      time: '2024-01-25T08:00:00Z'
    },
    dropoff: {
      address: 'Alaba International Market, Lagos',
      lat: 6.4698,
      lng: 3.1891,
      time: '2024-01-25T12:00:00Z'
    },
    cargo: {
      type: 'Electronics',
      weight: 2500,
      description: 'Consumer electronics and accessories'
    },
    price: 45000,
    distance: 28.5,
    duration: 120,
    notes: 'Fragile cargo, handle with care',
    createdAt: '2024-01-24T18:00:00Z',
    updatedAt: '2024-01-25T08:05:00Z'
  },
  {
    id: 'bkg_002',
    userId: 'usr_002',
    driverId: 'drv_002',
    truckId: 'trk_002',
    status: 'completed',
    pickup: {
      address: 'Ikeja Warehouse, Lagos',
      lat: 6.4471,
      lng: 3.2808,
      time: '2024-01-24T14:00:00Z'
    },
    dropoff: {
      address: 'Lekki Phase 1, Lagos',
      lat: 6.4511,
      lng: 3.4778,
      time: '2024-01-24T16:30:00Z'
    },
    cargo: {
      type: 'Furniture',
      weight: 1200,
      description: 'Office furniture and equipment'
    },
    price: 32000,
    distance: 18.2,
    duration: 90,
    createdAt: '2024-01-24T10:00:00Z',
    updatedAt: '2024-01-24T16:35:00Z'
  },
  {
    id: 'bkg_003',
    userId: 'usr_003',
    status: 'pending',
    pickup: {
      address: 'Apapa Port, Lagos',
      lat: 6.4500,
      lng: 3.3667,
      time: '2024-01-26T09:00:00Z'
    },
    dropoff: {
      address: 'Surulere, Lagos',
      lat: 6.5000,
      lng: 3.3500,
      time: '2024-01-26T11:00:00Z'
    },
    cargo: {
      type: 'Building Materials',
      weight: 5000,
      description: 'Cement and construction materials'
    },
    price: 58000,
    distance: 12.8,
    duration: 60,
    notes: 'Bulk cargo, tipper truck required',
    createdAt: '2024-01-25T10:00:00Z',
    updatedAt: '2024-01-25T10:00:00Z'
  }
];

export const transactions: Transaction[] = [
  {
    id: 'txn_001',
    type: 'trip_payment',
    amount: 45000,
    currency: 'NGN',
    status: 'completed',
    fromUserId: 'usr_001',
    toUserId: 'drv_001',
    bookingId: 'bkg_001',
    method: 'card',
    reference: 'TXN-2024-001',
    createdAt: '2024-01-25T08:10:00Z',
    completedAt: '2024-01-25T08:15:00Z'
  },
  {
    id: 'txn_002',
    type: 'commission',
    amount: 4500,
    currency: 'NGN',
    status: 'completed',
    fromUserId: 'drv_001',
    bookingId: 'bkg_001',
    method: 'wallet',
    reference: 'TXN-2024-002',
    createdAt: '2024-01-25T08:15:00Z',
    completedAt: '2024-01-25T08:15:00Z'
  },
  {
    id: 'txn_003',
    type: 'wallet_topup',
    amount: 100000,
    currency: 'NGN',
    status: 'completed',
    fromUserId: 'usr_002',
    method: 'bank_transfer',
    reference: 'TXN-2024-003',
    createdAt: '2024-01-24T12:00:00Z',
    completedAt: '2024-01-24T12:05:00Z'
  }
];

export const pricingConfigs: PricingConfig[] = [
  {
    id: 'price_001',
    name: 'Standard Flatbed',
    basePrice: 5000,
    perKm: 150,
    perMinute: 50,
    minimumFare: 8000,
    surgeMultiplier: 1.5,
    truckType: 'flatbed',
    active: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'price_002',
    name: 'Box Truck Standard',
    basePrice: 6000,
    perKm: 180,
    perMinute: 60,
    minimumFare: 10000,
    surgeMultiplier: 1.3,
    truckType: 'box_truck',
    active: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'price_003',
    name: 'Tipper Heavy Duty',
    basePrice: 8000,
    perKm: 200,
    perMinute: 80,
    minimumFare: 15000,
    surgeMultiplier: 1.8,
    truckType: 'tipper',
    active: true,
    createdAt: '2024-01-01T00:00:00Z'
  }
];

export const supportTickets: SupportTicket[] = [
  {
    id: 'tkt_001',
    userId: 'usr_001',
    type: 'payment',
    priority: 'high',
    status: 'in_progress',
    subject: 'Payment not reflecting in wallet',
    description: 'I made a transfer of ₦50,000 to my wallet but it has not reflected after 24 hours.',
    createdAt: '2024-01-25T09:00:00Z',
    updatedAt: '2024-01-25T14:30:00Z',
    responses: [
      {
        id: 'resp_001',
        ticketId: 'tkt_001',
        userId: 'usr_001',
        message: 'I have checked my bank statement and the money has been debited.',
        createdAt: '2024-01-25T09:05:00Z'
      },
      {
        id: 'resp_002',
        ticketId: 'tkt_001',
        userId: 'usr_002',
        message: 'We are investigating this issue. Please provide your transaction reference.',
        createdAt: '2024-01-25T10:00:00Z'
      }
    ]
  },
  {
    id: 'tkt_002',
    userId: 'drv_001',
    type: 'trip',
    priority: 'medium',
    status: 'open',
    subject: 'Issue with trip completion',
    description: 'I completed a trip but the app is not allowing me to mark it as complete.',
    createdAt: '2024-01-25T11:00:00Z',
    updatedAt: '2024-01-25T11:00:00Z',
    responses: []
  }
];

export const revenueChartData: ChartData[] = [
  { name: 'Jan', revenue: 4500000, trips: 1240 },
  { name: 'Feb', revenue: 5200000, trips: 1380 },
  { name: 'Mar', revenue: 4800000, trips: 1290 },
  { name: 'Apr', revenue: 6100000, trips: 1520 },
  { name: 'May', revenue: 5800000, trips: 1480 },
  { name: 'Jun', revenue: 7200000, trips: 1690 },
  { name: 'Jul', revenue: 6900000, trips: 1610 },
  { name: 'Aug', revenue: 7500000, trips: 1780 },
  { name: 'Sep', revenue: 8200000, trips: 1890 },
  { name: 'Oct', revenue: 7800000, trips: 1820 },
  { name: 'Nov', revenue: 8500000, trips: 1950 },
  { name: 'Dec', revenue: 9200000, trips: 2120 }
];

export const truckTypeDistribution: ChartData[] = [
  { name: 'Flatbed', value: 385, color: '#e94560' },
  { name: 'Box Truck', value: 298, color: '#16213e' },
  { name: 'Tanker', value: 142, color: '#0f3460' },
  { name: 'Tipper', value: 133, color: '#27ae60' }
];

export const bookingStatusData: ChartData[] = [
  { name: 'Completed', value: 15689, color: '#27ae60' },
  { name: 'In Progress', value: 423, color: '#2f80ed' },
  { name: 'Pending', value: 87, color: '#f2994a' },
  { name: 'Cancelled', value: 156, color: '#eb5757' }
];
