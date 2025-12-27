// =========================================================
// Rides Types – Unificard
// Estrutura completa alinhada às migrations 009–015
// =========================================================

import { GeographyPoint, UUID, JSONValue } from "@core/types";

// =========================================================
// ENUMS
// =========================================================

export enum RideRequestStatus {
  Pending = "pending",
  Searching = "searching",
  Offered = "offered",
  Cancelled = "cancelled",
}

export enum RideStatus {
  Assigned = "assigned",
  Arrived = "arrived",
  Started = "started",
  Completed = "completed",
  Cancelled = "cancelled",
}

export enum RideCancelledBy {
  Driver = "driver",
  Passenger = "passenger",
  System = "system",
}

export enum IncentiveType {
  PerKm = "per_km",
  PerRide = "per_ride",
  Bonus = "bonus",
}

export enum DriverSessionStatus {
  Active = "active",
  Break = "break",
  ForcedBreak = "forced_break",
  Ended = "ended",
}

// =========================================================
// BASE TYPES
// =========================================================

export interface Region {
  region_id: UUID;
  tenant_id: UUID;
  name: string;
  code?: string;
  metadata: JSONValue;
  created_at: string;
  updated_at: string;
}

export interface City {
  city_id: UUID;
  tenant_id: UUID;
  region_id?: UUID;
  name: string;
  code?: string;
  center?: GeographyPoint;
  is_active: boolean;
  metadata: JSONValue;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  zone_id: UUID;
  tenant_id: UUID;
  city_id: UUID;
  name: string;
  polygon: any; // GEOGRAPHY(POLYGON)
  centroid?: GeographyPoint;
  is_active: boolean;
  metadata: JSONValue;
  created_at: string;
  updated_at: string;
}

// =========================================================
// SERVICE TYPES
// =========================================================

export interface RideServiceType {
  service_type_id: UUID;
  tenant_id: UUID;
  name: string;
  description?: string;
  icon?: string;
  capacity: number;
  base_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CityServiceType {
  city_service_type_id: UUID;
  tenant_id: UUID;
  city_id: UUID;
  service_type_id: UUID;
  is_enabled: boolean;
  metadata: JSONValue;
  created_at: string;
  updated_at: string;
}

// =========================================================
// DRIVERS / VEHICLES
// =========================================================

export interface Driver {
  driver_id: UUID;
  tenant_id: UUID;
  user_id: UUID;

  is_active: boolean;
  is_verified: boolean;

  rating_avg?: number;
  rating_count: number;

  // added via patch 015
  total_trips_completed: number;
  total_trips_cancelled_driver: number;
  total_trips_cancelled_passenger: number;
  acceptance_rate?: number;
  cancellation_rate?: number;
  last_metrics_calculated_at?: string;

  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  vehicle_id: UUID;
  tenant_id: UUID;
  driver_id: UUID;

  brand?: string;
  model?: string;
  year?: number;
  plate: string;
  color?: string;
  type?: string;
  capacity: number;

  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export interface DriverService {
  driver_service_id: UUID;
  tenant_id: UUID;
  driver_id: UUID;
  service_type_id: UUID;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverLocation {
  location_id: UUID;
  tenant_id: UUID;
  driver_id: UUID;
  location: GeographyPoint;
  heading?: number;
  speed_kmh?: number;
  updated_at: string;
}

export interface DriverAvailability {
  availability_id: UUID;
  tenant_id: UUID;
  driver_id: UUID;

  is_online: boolean;
  dest_mode_enabled: boolean;
  dest_lat?: number;
  dest_lng?: number;

  updated_at: string;
}

// =========================================================
// DRIVER SESSIONS (Limite de 12 horas)
// =========================================================

export interface DriverSession {
  session_id: UUID;
  tenant_id: UUID;
  driver_id: UUID;

  started_at: string;
  ended_at?: string;

  driving_time_minutes: number;
  online_time_minutes: number;

  max_driving_hours: number;
  is_forced_break: boolean;
  forced_break_until?: string;
  last_break_at?: string;
}

// =========================================================
// RIDE REQUESTS
// =========================================================

export interface RideRequestStop {
  lat: number;
  lng: number;
  address?: string;
  order: number;
}

export interface RideRequest {
  request_id: UUID;
  tenant_id: UUID;

  passenger_id: UUID;

  origin: GeographyPoint;
  destination: GeographyPoint;

  passenger_count: number;
  stops: RideRequestStop[];
  stops_count: number;

  service_type_id: UUID;

  estimated_distance_km?: number;
  estimated_duration_min?: number;

  status: RideRequestStatus;

  created_at: string;
  updated_at: string;
}

export interface RideOffer {
  offer_id: UUID;
  tenant_id: UUID;
  request_id: UUID;
  driver_id: UUID;
  status: string; // pending | accepted | rejected
  created_at: string;
}

// =========================================================
// RIDES
// =========================================================

export interface Ride {
  ride_id: UUID;
  tenant_id: UUID;

  request_id: UUID;
  driver_id: UUID;
  vehicle_id: UUID;

  status: RideStatus;

  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;

  total_distance_km?: number;
  total_duration_min?: number;

  final_price?: number;

  created_at: string;
  updated_at: string;
}

export interface RideLocation {
  ride_location_id: UUID;
  tenant_id: UUID;
  ride_id: UUID;
  location: GeographyPoint;
  speed_kmh?: number;
  heading?: number;
  recorded_at: string;
}

export interface RideEvent {
  event_id: UUID;
  tenant_id: UUID;
  ride_id: UUID;
  event_type: string;
  payload: JSONValue;
  created_at: string;
}

// =========================================================
// WAIT EVENTS & CANCELLATIONS (patch 015)
// =========================================================

export interface RideWaitEvent {
  wait_event_id: UUID;
  tenant_id: UUID;
  ride_id: UUID;

  driver_arrived_at?: string;
  passenger_notified_at?: string;

  free_wait_seconds?: number;
  charged_wait_seconds?: number;
  wait_fee_amount?: number;

  created_at: string;
}

export interface RideCancellation {
  cancellation_id: UUID;
  tenant_id: UUID;
  ride_id: UUID;

  cancelled_by: RideCancelledBy;
  reason_code: string;

  is_penalized_driver: boolean;
  is_penalized_passenger: boolean;

  distance_driver_travelled_km?: number;
  time_driver_travelled_sec?: number;
  cancellation_fee_passenger?: number;
  amount_paid_to_driver?: number;

  created_at: string;
}

// =========================================================
// PRICING
// =========================================================

export interface PricingConfig {
  pricing_config_id: UUID;
  tenant_id: UUID;
  city_id: UUID;

  base_fare: number;
  per_km: number;
  per_minute: number;

  night_multiplier?: number;
  rain_multiplier?: number;

  created_at: string;
  updated_at: string;
}

export interface ZoneDemandPressure {
  pressure_id: UUID;
  tenant_id: UUID;
  zone_id: UUID;

  active_requests: number;
  available_drivers: number;
  pressure?: number;

  calculated_at: string;
}

export interface ZoneIncentive {
  incentive_id: UUID;
  tenant_id: UUID;
  zone_id: UUID;

  incentive_type: IncentiveType;
  incentive_value: number;

  reason: string;

  starts_at?: string;
  expires_at?: string;
  is_active: boolean;

  created_at: string;
}

// =========================================================
// DISTRIBUTION
// =========================================================

export interface DistributionRule {
  rule_id: UUID;
  tenant_id: UUID;

  name: string;

  percentage_driver: number;
  percentage_platform: number;
  percentage_fund: number;
  percentage_referral: number;

  is_active: boolean;
  created_at: string;
}

export interface RideDistribution {
  ride_distribution_id: UUID;
  tenant_id: UUID;

  ride_id: UUID;

  driver_amount: number;
  platform_amount: number;
  fund_amount: number;
  referral_amount: number;

  rule_snapshot: JSONValue;

  created_at: string;
}

// =========================================================
// ANALYTICS & SECURITY
// =========================================================

export interface EmergencyContact {
  emergency_contact_id: UUID;
  tenant_id: UUID;
  user_id: UUID;
  name: string;
  phone: string;
  created_at: string;
}

export interface RideShare {
  ride_share_id: UUID;
  tenant_id: UUID;
  ride_id: UUID;
  shared_with: UUID;
  created_at: string;
}

export interface RideDispute {
  dispute_id: UUID;
  tenant_id: UUID;
  ride_id: UUID;

  opened_by?: UUID;
  status: string;
  reason?: string;
  resolution?: string;

  created_at: string;
  updated_at: string;
}

export interface DriverEarningsHistory {
  earnings_id: UUID;
  tenant_id: UUID;
  driver_id: UUID;

  ride_id?: UUID;
  amount: number;

  created_at: string;
}

// =========================================================
// PREFERÊNCIAS & PASSENGER STATS (patch 015)
// =========================================================

export interface DriverPreferences {
  preference_id: UUID;
  tenant_id: UUID;
  driver_id: UUID;

  accept_cash: boolean;
  min_passenger_rating?: number;
  region_preference_enabled: boolean;
  preferred_zone_ids?: UUID[];
  allow_teen_rides: boolean;
  allow_late_night: boolean;
  service_type_ids?: UUID[];

  created_at: string;
  updated_at: string;
}

export interface PassengerStats {
  passenger_stats_id: UUID;
  tenant_id: UUID;
  passenger_user_id: UUID;

  total_trips_completed: number;
  total_trips_cancelled: number;
  rating_avg?: number;
  rating_count: number;
  last_trip_at?: string;
  first_trip_at?: string;

  no_show_count: number;
  late_show_count: number;

  created_at: string;
  updated_at: string;
}
