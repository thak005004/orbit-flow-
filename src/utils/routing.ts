import type { Station, Edge, Shipment } from '../types';

export interface RoutingResult {
  path: string[];
  cost: number;
  feasible: boolean;
  reason?: string;
}

/**
 * Modified Dijkstra's algorithm that considers:
 * - Route capacity constraints (skips edges without enough remaining capacity)
 * - Congestion weighting (penalizes heavily loaded routes)
 * - Priority weighting for critical shipments
 */
export function findOptimalPath(
  stations: Station[],
  edges: Edge[],
  originId: string,
  destinationId: string,
  weight: number
): RoutingResult {
  if (originId === destinationId) {
    return { path: [originId], cost: 0, feasible: false, reason: 'Origin and destination are the same.' };
  }

  // Check destination capacity
  const destStation = stations.find(s => s.id === destinationId);
  if (!destStation) return { path: [], cost: Infinity, feasible: false, reason: 'Destination not found.' };

  const destFreeCapacity = destStation.capacity - destStation.currentLoad;
  if (destFreeCapacity < weight) {
    return {
      path: [],
      cost: Infinity,
      feasible: false,
      reason: `Destination ${destStation.shortName} is over capacity (${destFreeCapacity.toFixed(0)} units free, need ${weight}).`,
    };
  }

  // Build weighted adjacency list
  const adjacency = new Map<string, Array<{ to: string; cost: number; edgeId: string }>>();
  for (const station of stations) {
    adjacency.set(station.id, []);
  }

  for (const edge of edges) {
    const remaining = edge.maxCapacity - edge.currentLoad;
    if (remaining < weight) continue; // Capacity constraint

    // Congestion factor: 0% load = 1.0x cost, 100% load = 1.5x cost
    const congestion = 1 + (edge.currentLoad / edge.maxCapacity) * 0.5;
    const effectiveCost = edge.cost * congestion;

    adjacency.get(edge.from)?.push({ to: edge.to, cost: effectiveCost, edgeId: edge.id });
    adjacency.get(edge.to)?.push({ to: edge.from, cost: effectiveCost, edgeId: edge.id });
  }

  // Dijkstra's algorithm
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const station of stations) {
    distances.set(station.id, Infinity);
    previous.set(station.id, null);
  }
  distances.set(originId, 0);

  // Min-heap simulation using sorted array
  const queue: Array<{ id: string; cost: number }> = [{ id: originId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id === destinationId) break;

    const neighbors = adjacency.get(current.id) ?? [];
    for (const neighbor of neighbors) {
      const newCost = (distances.get(current.id) ?? Infinity) + neighbor.cost;
      if (newCost < (distances.get(neighbor.to) ?? Infinity)) {
        distances.set(neighbor.to, newCost);
        previous.set(neighbor.to, current.id);
        queue.push({ id: neighbor.to, cost: newCost });
      }
    }
  }

  const finalCost = distances.get(destinationId) ?? Infinity;
  if (!isFinite(finalCost)) {
    return {
      path: [],
      cost: Infinity,
      feasible: false,
      reason: 'No viable route found. All paths may be over capacity.',
    };
  }

  // Reconstruct path
  const path: string[] = [];
  let curr: string | null = destinationId;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous.get(curr) ?? null;
  }

  if (path[0] !== originId) {
    return { path: [], cost: Infinity, feasible: false, reason: 'Path reconstruction failed.' };
  }

  return { path, cost: finalCost, feasible: true };
}

/**
 * Advance a shipment by one simulation tick.
 * Returns updated shipment (immutable).
 */
export function advanceShipment(shipment: Shipment, edges: Edge[], tickSpeed = 0.04): Shipment {
  if (shipment.status !== 'in-transit') return shipment;
  if (shipment.path.length < 2) return { ...shipment, status: 'delivered', deliveredAt: Date.now() };

  const currentLeg = shipment.currentLeg;
  const totalLegs = shipment.path.length - 1;

  if (currentLeg >= totalLegs) {
    return { ...shipment, status: 'delivered', deliveredAt: Date.now() };
  }

  // Get current edge cost to determine leg duration
  const fromId = shipment.path[currentLeg];
  const toId = shipment.path[currentLeg + 1];
  const edge = edges.find(
    e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
  );

  if (!edge) {
    console.warn(`[routing] No edge found between "${fromId}" and "${toId}" for shipment "${shipment.id}". Defaulting leg cost to 1.`);
  }
  const legCost = edge?.cost ?? 1;
  // Progress per tick: normalize by leg cost so longer routes take more time
  const progressPerTick = tickSpeed / legCost;
  const newProgress = shipment.legProgress + progressPerTick;

  if (newProgress >= 1) {
    const nextLeg = currentLeg + 1;
    if (nextLeg >= totalLegs) {
      return { ...shipment, status: 'delivered', deliveredAt: Date.now(), legProgress: 1, currentLeg: nextLeg };
    }
    return { ...shipment, currentLeg: nextLeg, legProgress: 0 };
  }

  return { ...shipment, legProgress: newProgress };
}

/**
 * Get the current XY interpolated position of a shipment on the graph.
 */
export function getShipmentPosition(
  shipment: Shipment,
  stations: Station[]
): { x: number; y: number } | null {
  if (shipment.status !== 'in-transit') return null;
  if (shipment.path.length < 2) return null;

  const fromId = shipment.path[shipment.currentLeg];
  const toId = shipment.path[Math.min(shipment.currentLeg + 1, shipment.path.length - 1)];

  const from = stations.find(s => s.id === fromId);
  const to = stations.find(s => s.id === toId);
  if (!from || !to) return null;

  return {
    x: from.x + (to.x - from.x) * shipment.legProgress,
    y: from.y + (to.y - from.y) * shipment.legProgress,
  };
}

/**
 * Check if a specific edge is currently active (has a shipment traversing it).
 */
export function isEdgeActive(edge: Edge, shipments: Shipment[]): boolean {
  return shipments.some(s => {
    if (s.status !== 'in-transit') return false;
    const fromId = s.path[s.currentLeg];
    const toId = s.path[s.currentLeg + 1];
    return (
      (fromId === edge.from && toId === edge.to) ||
      (fromId === edge.to && toId === edge.from)
    );
  });
}

/**
 * Check if an edge is part of the highlighted path.
 */
export function isEdgeInPath(edge: Edge, path: string[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (
      (path[i] === edge.from && path[i + 1] === edge.to) ||
      (path[i] === edge.to && path[i + 1] === edge.from)
    ) return true;
  }
  return false;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * BFS over the graph ignoring capacity — returns the fewest hops between
 * two stations if they are connected, or -1 if unreachable.
 */
export function findMinHops(edges: Edge[], fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; hops: number }> = [{ id: fromId, hops: 0 }];

  while (queue.length > 0) {
    const { id, hops } = queue.shift()!;
    for (const edge of edges) {
      const neighbor =
        edge.from === id ? edge.to :
        edge.to   === id ? edge.from :
        null;
      if (!neighbor || visited.has(neighbor)) continue;
      if (neighbor === toId) return hops + 1;
      visited.add(neighbor);
      queue.push({ id: neighbor, hops: hops + 1 });
    }
  }
  return -1; // disconnected
}

/**
 * Route efficiency score (0–100) composed of three factors:
 *
 *  45% — Hop efficiency:    optimalHops / actualHops
 *          (1.0 when the routed path is already shortest hop-count)
 *  35% — Capacity fill:     weight / bottleneck edge capacity, clamped [0,1]
 *          (rewards shipments that make good use of available throughput)
 *  20% — Priority weight:   critical 1.0 · high 0.75 · medium 0.5 · low 0.25
 *          (important cargo is credited for being dispatched at all)
 */
export function calculateEfficiencyScore(
  path: string[],
  weight: number,
  priority: import('../types').Priority,
  edges: Edge[]
): number {
  if (path.length < 2) return 0;

  const actualHops = path.length - 1;

  // Hop efficiency
  const optimalHops = findMinHops(edges, path[0], path[path.length - 1]);
  const hopScore = optimalHops > 0 ? Math.min(optimalHops / actualHops, 1) : 1;

  // Capacity fill — find the bottleneck (minimum maxCapacity along the path)
  let bottleneck = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = edges.find(
      e => (e.from === path[i] && e.to === path[i + 1]) ||
           (e.from === path[i + 1] && e.to === path[i])
    );
    if (edge) bottleneck = Math.min(bottleneck, edge.maxCapacity);
  }
  const capacityScore = bottleneck === Infinity ? 0.5 : Math.min(weight / bottleneck, 1);

  // Priority weight
  const priorityWeight: Record<string, number> = {
    critical: 1.00,
    high:     0.75,
    medium:   0.50,
    low:      0.25,
  };
  const priorityScore = priorityWeight[priority] ?? 0.5;

  const raw = hopScore * 0.45 + capacityScore * 0.35 + priorityScore * 0.20;
  return Math.round(Math.min(raw, 1) * 100);
}
