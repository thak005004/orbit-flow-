import type { Station, Edge, Anomaly } from '../types';

const WARN_THRESHOLD = 0.8;
const CRIT_THRESHOLD = 0.95;

export function detectAnomalies(stations: Station[], edges: Edge[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const st of stations) {
    const pct = st.capacity > 0 ? st.currentLoad / st.capacity : 0;
    if (pct >= CRIT_THRESHOLD) {
      anomalies.push({
        id: `depot-${st.id}`,
        type: 'critical',
        category: 'depot-capacity',
        entityId: st.id,
        entityName: st.name,
        message: `${st.shortName} critically overloaded at ${(pct * 100).toFixed(0)}% capacity`,
        pct,
      });
    } else if (pct >= WARN_THRESHOLD) {
      anomalies.push({
        id: `depot-${st.id}`,
        type: 'warning',
        category: 'depot-capacity',
        entityId: st.id,
        entityName: st.name,
        message: `${st.shortName} nearing capacity at ${(pct * 100).toFixed(0)}%`,
        pct,
      });
    }
  }

  for (const edge of edges) {
    const pct = edge.maxCapacity > 0 ? edge.currentLoad / edge.maxCapacity : 0;
    if (pct <= 0) continue;

    const fromStation = stations.find(s => s.id === edge.from);
    const toStation = stations.find(s => s.id === edge.to);
    const routeLabel = `${fromStation?.shortName ?? edge.from} → ${toStation?.shortName ?? edge.to}`;

    if (pct >= CRIT_THRESHOLD) {
      anomalies.push({
        id: `route-${edge.id}`,
        type: 'critical',
        category: 'route-capacity',
        entityId: edge.id,
        entityName: routeLabel,
        message: `Route ${routeLabel} saturated at ${(pct * 100).toFixed(0)}% throughput`,
        pct,
      });
    } else if (pct >= WARN_THRESHOLD) {
      anomalies.push({
        id: `route-${edge.id}`,
        type: 'warning',
        category: 'route-capacity',
        entityId: edge.id,
        entityName: routeLabel,
        message: `Route ${routeLabel} congested at ${(pct * 100).toFixed(0)}% throughput`,
        pct,
      });
    }
  }

  return anomalies;
}
