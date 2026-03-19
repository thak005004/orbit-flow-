import React, { useState, useEffect, useMemo } from 'react';
import type { Shipment, Edge, Station } from '../types';

interface StatsPanelProps {
  shipments: Shipment[];
  edges: Edge[];
  stations: Station[];
}

// ─── helpers ───────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="glass-light rounded-lg border border-slate-700/40 p-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>
      <span
        className="text-xl font-bold font-mono"
        style={{ color: accent ?? 'white' }}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-slate-600 font-mono">{sub}</span>}
    </div>
  );
}

// ─── busiest routes ─────────────────────────────────────────────────────────

interface RouteTraffic {
  edgeId: string;
  label: string;
  totalWeight: number;
  shipmentCount: number;
}

function useBusiestRoutes(
  shipments: Shipment[],
  edges: Edge[],
  stations: Station[]
): RouteTraffic[] {
  return useMemo(() => {
    const traffic = new Map<string, RouteTraffic>();

    for (const s of shipments) {
      for (let i = 0; i < s.path.length - 1; i++) {
        const a = s.path[i];
        const b = s.path[i + 1];
        const edge = edges.find(
          e => (e.from === a && e.to === b) || (e.from === b && e.to === a)
        );
        if (!edge) continue;

        const existing = traffic.get(edge.id);
        if (existing) {
          existing.totalWeight += s.weight;
          existing.shipmentCount += 1;
        } else {
          const fromSt = stations.find(st => st.id === edge.from);
          const toSt   = stations.find(st => st.id === edge.to);
          traffic.set(edge.id, {
            edgeId: edge.id,
            label: `${fromSt?.shortName ?? edge.from} → ${toSt?.shortName ?? edge.to}`,
            totalWeight: s.weight,
            shipmentCount: 1,
          });
        }
      }
    }

    return Array.from(traffic.values())
      .sort((a, b) => b.totalWeight - a.totalWeight)
      .slice(0, 5);
  }, [shipments, edges, stations]);
}

// ─── efficiency breakdown ───────────────────────────────────────────────────

function EfficiencyBreakdown({ shipments }: { shipments: Shipment[] }) {
  const counts = useMemo(() => {
    const c = { optimal: 0, good: 0, fair: 0, poor: 0 };
    for (const s of shipments) {
      const sc = s.efficiencyScore;
      if (sc >= 80) c.optimal++;
      else if (sc >= 60) c.good++;
      else if (sc >= 40) c.fair++;
      else c.poor++;
    }
    return c;
  }, [shipments]);

  const total = shipments.length;

  const tiers = [
    { label: 'OPTIMAL', key: 'optimal' as const, color: '#10b981' },
    { label: 'GOOD',    key: 'good'    as const, color: '#eab308' },
    { label: 'FAIR',    key: 'fair'    as const, color: '#f97316' },
    { label: 'POOR',    key: 'poor'    as const, color: '#ef4444' },
  ];

  return (
    <div className="flex flex-col gap-2">
      {tiers.map(tier => {
        const count = counts[tier.key];
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={tier.key} className="flex items-center gap-2">
            <span className="text-[10px] font-mono w-14 flex-shrink-0" style={{ color: tier.color }}>
              {tier.label}
            </span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: tier.color,
                  boxShadow: `0 0 4px ${tier.color}66`,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── main component ─────────────────────────────────────────────────────────

export default function StatsPanel({ shipments, edges, stations }: StatsPanelProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const delivered   = useMemo(() => shipments.filter(s => s.status === 'delivered'), [shipments]);
  const inTransit   = useMemo(() => shipments.filter(s => s.status === 'in-transit'), [shipments]);
  const allStarted  = useMemo(() => shipments.filter(s => s.status !== 'pending'), [shipments]);

  // Total cargo delivered
  const totalWeightDelivered = useMemo(
    () => delivered.reduce((sum, s) => sum + s.weight, 0),
    [delivered]
  );

  // Average delivery time (ms)
  const avgDeliveryMs = useMemo(() => {
    const timed = delivered.filter(s => s.deliveredAt !== undefined);
    if (timed.length === 0) return 0;
    return timed.reduce((sum, s) => sum + (s.deliveredAt! - s.createdAt), 0) / timed.length;
  }, [delivered]);

  // Success rate
  const successRate = allStarted.length > 0
    ? Math.round((delivered.length / allStarted.length) * 100)
    : 0;

  // Live throughput: weight delivered per real-time minute
  const throughput = useMemo(() => {
    if (shipments.length === 0 || totalWeightDelivered === 0) return 0;
    const earliest = Math.min(...shipments.map(s => s.createdAt));
    const elapsedMin = (now - earliest) / 60_000;
    return elapsedMin > 0 ? totalWeightDelivered / elapsedMin : 0;
  }, [shipments, totalWeightDelivered, now]);

  // Weight currently in transit
  const inTransitWeight = useMemo(
    () => inTransit.reduce((sum, s) => sum + s.weight, 0),
    [inTransit]
  );

  // Average efficiency score
  const avgEfficiency = useMemo(() => {
    if (shipments.length === 0) return 0;
    return Math.round(
      shipments.reduce((sum, s) => sum + s.efficiencyScore, 0) / shipments.length
    );
  }, [shipments]);

  const busiestRoutes = useBusiestRoutes(shipments, edges, stations);
  const maxRouteWeight = busiestRoutes[0]?.totalWeight ?? 1;

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-panel">

      {/* ── Key metrics ──────────────────────────────────────────────── */}
      <div className="p-3 border-b border-slate-800/60">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">
          Delivery Summary
        </span>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Cargo Delivered"
            value={`${totalWeightDelivered.toLocaleString()}`}
            sub={`${delivered.length} shipment${delivered.length !== 1 ? 's' : ''}`}
            accent="#10b981"
          />
          <StatCard
            label="Avg Delivery Time"
            value={avgDeliveryMs > 0 ? formatDuration(avgDeliveryMs) : '—'}
            sub={delivered.length > 0 ? `over ${delivered.length} runs` : 'no data yet'}
          />
          <StatCard
            label="Success Rate"
            value={allStarted.length > 0 ? `${successRate}%` : '—'}
            sub={`${allStarted.length} dispatched`}
            accent={successRate >= 80 ? '#10b981' : successRate >= 50 ? '#eab308' : '#ef4444'}
          />
          <StatCard
            label="In Transit"
            value={`${inTransitWeight.toLocaleString()}`}
            sub={`${inTransit.length} active`}
            accent="#3b82f6"
          />
        </div>
      </div>

      {/* ── Throughput ───────────────────────────────────────────────── */}
      <div className="p-3 border-b border-slate-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Network Throughput
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono text-cyan-400">LIVE</span>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <span className="text-2xl font-bold font-mono text-cyan-400">
              {throughput >= 1 ? throughput.toFixed(1) : throughput.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">units/min</span>
          </div>
          <div className="flex-1 text-right">
            <span className="text-xs font-mono text-slate-600">
              {totalWeightDelivered.toLocaleString()} total delivered
            </span>
          </div>
        </div>
        {/* Throughput bar — relative fill vs a soft max */}
        {throughput > 0 && (
          <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min((throughput / 20) * 100, 100)}%`,
                background: 'linear-gradient(90deg, #0891b2, #06b6d4)',
                boxShadow: '0 0 6px #06b6d488',
              }}
            />
          </div>
        )}
        {shipments.length === 0 && (
          <p className="text-[10px] text-slate-700 font-mono mt-1">
            Dispatch shipments to see throughput
          </p>
        )}
      </div>

      {/* ── Busiest routes ───────────────────────────────────────────── */}
      <div className="p-3 border-b border-slate-800/60">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">
          Busiest Routes
        </span>
        {busiestRoutes.length === 0 ? (
          <p className="text-[10px] text-slate-700 font-mono">No route data yet</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {busiestRoutes.map((r, i) => (
              <div key={r.edgeId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-600 w-4">#{i + 1}</span>
                    <span className="text-[11px] font-mono text-slate-300">{r.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      {r.shipmentCount} ship{r.shipmentCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      {r.totalWeight.toLocaleString()} u
                    </span>
                  </div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(r.totalWeight / maxRouteWeight) * 100}%`,
                      background:
                        i === 0
                          ? 'linear-gradient(90deg, #0891b2, #06b6d4)'
                          : i === 1
                          ? 'linear-gradient(90deg, #1d4ed8, #3b82f6)'
                          : '#334155',
                      boxShadow: i < 2 ? '0 0 4px #06b6d444' : 'none',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Efficiency breakdown ─────────────────────────────────────── */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Efficiency Distribution
          </span>
          {shipments.length > 0 && (
            <span className="text-[10px] font-mono text-slate-400">
              avg{' '}
              <span
                className="font-bold"
                style={{
                  color:
                    avgEfficiency >= 80 ? '#10b981' :
                    avgEfficiency >= 60 ? '#eab308' :
                    avgEfficiency >= 40 ? '#f97316' : '#ef4444',
                }}
              >
                {avgEfficiency}%
              </span>
            </span>
          )}
        </div>
        {shipments.length === 0 ? (
          <p className="text-[10px] text-slate-700 font-mono">No shipment data yet</p>
        ) : (
          <EfficiencyBreakdown shipments={shipments} />
        )}
      </div>
    </div>
  );
}
