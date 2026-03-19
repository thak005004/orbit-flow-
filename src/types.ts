export type StationType = 'hub' | 'depot' | 'outpost' | 'gateway' | 'mining';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ShipmentStatus = 'pending' | 'in-transit' | 'delivered' | 'failed';

export interface Station {
  id: string;
  name: string;
  shortName: string;
  x: number;
  y: number;
  capacity: number;
  currentLoad: number;
  type: StationType;
  description: string;
  region: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  cost: number;        // travel cost in days
  maxCapacity: number; // max weight per cycle
  currentLoad: number;
  distanceAU: number;  // distance in Astronomical Units
}

export interface Shipment {
  id: string;
  name: string;
  weight: number;
  priority: Priority;
  origin: string;
  destination: string;
  path: string[];
  status: ShipmentStatus;
  createdAt: number;
  totalCost: number;
  currentLeg: number;
  legProgress: number;
  deliveredAt?: number;
  errorMsg?: string;
  efficiencyScore: number; // 0-100
  fuelCost: number;        // credits (₡)
}

export interface ShipmentFormData {
  name: string;
  weight: number;
  priority: Priority;
  origin: string;
  destination: string;
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  critical: { label: 'CRITICAL', color: 'text-red-400',    bgColor: 'bg-red-950/60',    borderColor: 'border-red-500/50', dotColor: '#f87171' },
  high:     { label: 'HIGH',     color: 'text-orange-400', bgColor: 'bg-orange-950/60', borderColor: 'border-orange-500/50', dotColor: '#fb923c' },
  medium:   { label: 'MEDIUM',   color: 'text-yellow-400', bgColor: 'bg-yellow-950/60', borderColor: 'border-yellow-500/50', dotColor: '#facc15' },
  low:      { label: 'LOW',      color: 'text-green-400',  bgColor: 'bg-green-950/60',  borderColor: 'border-green-500/50', dotColor: '#4ade80' },
};

export const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; bgColor: string; dot: string }> = {
  pending:    { label: 'PENDING',    color: 'text-slate-400', bgColor: 'bg-slate-800/60', dot: 'bg-slate-400' },
  'in-transit': { label: 'IN TRANSIT', color: 'text-blue-400',  bgColor: 'bg-blue-950/60',  dot: 'bg-blue-400' },
  delivered:  { label: 'DELIVERED',  color: 'text-green-400', bgColor: 'bg-green-950/60', dot: 'bg-green-400' },
  failed:     { label: 'FAILED',     color: 'text-red-400',   bgColor: 'bg-red-950/60',   dot: 'bg-red-400' },
};

export interface DijkstraStep {
  currentNode: string | null;   // node being examined this tick (null = init or done)
  visitedNodes: string[];       // fully settled nodes
  frontierNodes: string[];      // nodes queued but not yet settled
  finalPath: string[] | null;   // populated only on the last step
}

export type AnomalyType = 'warning' | 'critical';
export type AnomalyCategory = 'depot-capacity' | 'route-capacity';

export interface Anomaly {
  id: string;            // stable key: "depot-<stationId>" or "route-<edgeId>"
  type: AnomalyType;
  category: AnomalyCategory;
  entityId: string;
  entityName: string;
  message: string;
  pct: number;           // 0-1 load ratio
}

export interface NotificationEntry {
  id: string;
  anomalyId: string;
  type: AnomalyType | 'resolved';
  message: string;
  timestamp: number;
}

export const TYPE_CONFIG: Record<StationType, { color: string; strokeColor: string; label: string }> = {
  hub:     { color: '#06b6d4', strokeColor: '#0891b2', label: 'Hub' },
  gateway: { color: '#3b82f6', strokeColor: '#2563eb', label: 'Gateway' },
  depot:   { color: '#a855f7', strokeColor: '#9333ea', label: 'Depot' },
  outpost: { color: '#10b981', strokeColor: '#059669', label: 'Outpost' },
  mining:  { color: '#f59e0b', strokeColor: '#d97706', label: 'Mining Post' },
};
