import React, { useMemo, useState } from 'react';
import type { Station, Edge, Shipment } from '../types';
import { PRIORITY_CONFIG, STATUS_CONFIG, TYPE_CONFIG } from '../types';
import { calculateRemainingDays } from '../utils/routing';

interface DashboardProps {
  stations: Station[];
  edges: Edge[];
  shipments: Shipment[];
  onHighlightPath: (path: string[], id?: string) => void;
  highlightedShipmentId: string | null;
  onCancelShipment: (id: string) => void;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`glass rounded-lg border p-3 flex flex-col gap-0.5 ${color}`}>
      <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold font-mono text-white">{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

function CapacityBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-slate-400">{label}</span>
        <span className="text-xs font-mono text-slate-500">{used.toFixed(0)}/{total}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function efficiencyColor(score: number): string {
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444';                  // red
}

function efficiencyLabel(score: number): string {
  if (score >= 80) return 'OPTIMAL';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  return 'POOR';
}

function EfficiencyBar({ score }: { score: number }) {
  const color = efficiencyColor(score);
  const label = efficiencyLabel(score);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="text-[10px] font-mono text-slate-600 w-14 flex-shrink-0">EFFIC.</span>
      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}88`,
          }}
        />
      </div>
      <span
        className="text-[10px] font-mono font-bold w-16 text-right flex-shrink-0"
        style={{ color }}
      >
        {score}% <span className="font-normal opacity-70">{label}</span>
      </span>
    </div>
  );
}

function formatETA(days: number): string {
  if (days <= 0) return 'arriving';
  if (days < 0.1) return '< 0.1d';
  if (days < 10)  return `~${days.toFixed(1)}d`;
  return `~${Math.round(days)}d`;
}

function ShipmentCard({
  shipment,
  stations,
  edges,
  isHighlighted,
  onClick,
  onCancel,
}: {
  shipment: Shipment;
  stations: Station[];
  edges: Edge[];
  isHighlighted: boolean;
  onClick: () => void;
  onCancel?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const priorityCfg = PRIORITY_CONFIG[shipment.priority];
  const statusCfg = STATUS_CONFIG[shipment.status];
  const origin = stations.find(s => s.id === shipment.origin);
  const dest = stations.find(s => s.id === shipment.destination);

  const progress =
    shipment.status === 'delivered'
      ? 100
      : shipment.path.length < 2
      ? 0
      : Math.round(
          ((shipment.currentLeg + shipment.legProgress) / (shipment.path.length - 1)) * 100
        );

  const elapsed = ((Date.now() - shipment.createdAt) / 1000).toFixed(0);

  return (
    <div
      className={`rounded-lg border cursor-pointer transition-all duration-200 p-3 ${
        isHighlighted
          ? 'border-yellow-500/60 bg-yellow-950/20'
          : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600/60 hover:bg-slate-800/40'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-white truncate">{shipment.name}</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${priorityCfg.color} ${priorityCfg.bgColor} ${priorityCfg.borderColor}`}>
              {priorityCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
            <span>{origin?.shortName ?? '?'}</span>
            <span className="text-slate-600">→</span>
            <span>{dest?.shortName ?? '?'}</span>
            <span className="text-slate-700 ml-1">·</span>
            <span>{shipment.weight} units</span>
            <span className="text-slate-700">·</span>
            <span className="text-amber-500/80">₡{shipment.fuelCost.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono ${statusCfg.color} ${statusCfg.bgColor} border-slate-700/30`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${shipment.status === 'in-transit' ? 'animate-pulse' : ''}`} />
            {statusCfg.label}
          </div>

          {/* Cancel button — only for active shipments */}
          {onCancel && (shipment.status === 'in-transit' || shipment.status === 'pending') && (
            confirming ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <span className="text-[9px] font-mono text-red-400">Cancel?</span>
                <button
                  onClick={() => { onCancel(); setConfirming(false); }}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-colors"
                >Yes</button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-500 border border-slate-700/40 hover:text-slate-300 transition-colors"
                >No</button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setConfirming(true); }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors"
                title="Cancel shipment"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor:
                shipment.status === 'delivered' ? '#10b981' :
                shipment.status === 'failed' ? '#ef4444' :
                '#3b82f6',
            }}
          />
        </div>
        <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{progress}%</span>
      </div>

      {/* Efficiency score */}
      <EfficiencyBar score={shipment.efficiencyScore} />

      {shipment.status === 'in-transit' && (
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-600 font-mono flex-wrap">
          <span>Leg {shipment.currentLeg + 1}/{shipment.path.length - 1}</span>
          <span>·</span>
          <span>{elapsed}s ago</span>
          <span>·</span>
          <span className="text-cyan-500/80 font-semibold">
            ETA {formatETA(calculateRemainingDays(shipment, edges))}
          </span>
        </div>
      )}
      {shipment.status === 'failed' && shipment.errorMsg && (
        <div className="mt-1.5 text-[10px] font-mono text-red-400/70">
          ✕ {shipment.errorMsg}
        </div>
      )}

      {shipment.path.length > 1 && (
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          {shipment.path.map((nodeId, i) => {
            const s = stations.find(st => st.id === nodeId);
            const isCurrent = i === shipment.currentLeg && shipment.status === 'in-transit';
            return (
              <React.Fragment key={nodeId}>
                <span
                  className={`text-[9px] font-mono px-1 rounded ${
                    isCurrent
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : i < shipment.currentLeg
                      ? 'text-slate-600'
                      : 'text-slate-500'
                  }`}
                >
                  {s?.shortName ?? nodeId}
                </span>
                {i < shipment.path.length - 1 && (
                  <span className="text-[9px] text-slate-700">›</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({
  stations,
  edges,
  shipments,
  onHighlightPath,
  highlightedShipmentId,
  onCancelShipment,
}: DashboardProps) {
  const stats = useMemo(() => {
    const inTransit = shipments.filter(s => s.status === 'in-transit').length;
    const delivered = shipments.filter(s => s.status === 'delivered').length;
    const pending = shipments.filter(s => s.status === 'pending').length;
    const failed = shipments.filter(s => s.status === 'failed').length;
    const totalLoad = stations.reduce((s, st) => s + st.currentLoad, 0);
    const totalCap = stations.reduce((s, st) => s + st.capacity, 0);
    const activeEdges = edges.filter(e => e.currentLoad > 0).length;
    return { inTransit, delivered, pending, failed, totalLoad, totalCap, activeEdges };
  }, [shipments, stations, edges]);

  const [search, setSearch] = useState('');

  const sortedShipments = useMemo(() => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder: Record<string, number> = { 'in-transit': 0, pending: 1, delivered: 2, failed: 3 };
    return [...shipments].sort((a, b) => {
      const sd = statusOrder[a.status] - statusOrder[b.status];
      if (sd !== 0) return sd;
      return order[a.priority] - order[b.priority];
    });
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedShipments;
    return sortedShipments.filter(s => {
      const origin = stations.find(st => st.id === s.origin);
      const dest   = stations.find(st => st.id === s.destination);
      return (
        s.name.toLowerCase().includes(q) ||
        s.priority.includes(q) ||
        s.status.includes(q) ||
        origin?.shortName.toLowerCase().includes(q) ||
        origin?.name.toLowerCase().includes(q) ||
        dest?.shortName.toLowerCase().includes(q) ||
        dest?.name.toLowerCase().includes(q)
      );
    });
  }, [sortedShipments, search, stations]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* System Stats */}
      <div className="p-3 border-b border-slate-800/60">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">System Status</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-mono">ONLINE</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="In Transit" value={stats.inTransit} color="border-blue-500/20" sub={`+${stats.pending} pending`} />
          <StatCard label="Delivered" value={stats.delivered} color="border-green-500/20" sub={`${stats.failed > 0 ? stats.failed + ' failed' : 'all clear'}`} />
          <StatCard label="Active Routes" value={stats.activeEdges} color="border-cyan-500/20" sub={`of ${edges.length} total`} />
          <StatCard
            label="Sys. Capacity"
            value={`${((stats.totalLoad / stats.totalCap) * 100).toFixed(0)}%`}
            color="border-purple-500/20"
            sub={`${stats.totalLoad.toFixed(0)} / ${stats.totalCap}`}
          />
        </div>
      </div>

      {/* Depot Capacity */}
      <div className="border-b border-slate-800/60">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Depot Capacity</span>
          <span className="text-[10px] font-mono text-slate-600">{stations.length} stations</span>
        </div>
        <div className="overflow-y-auto scrollbar-thin-panel max-h-[168px] px-3 pb-3 flex flex-col gap-2">
          {stations.map(st => {
            const cfg = TYPE_CONFIG[st.type];
            const pct = st.currentLoad / st.capacity;
            const color = pct > 0.85 ? '#ef4444' : pct > 0.6 ? '#f59e0b' : cfg.color;
            return (
              <CapacityBar
                key={st.id}
                label={`${st.shortName} — ${st.name.split(' ').slice(0, 2).join(' ')}`}
                used={st.currentLoad}
                total={st.capacity}
                color={color}
              />
            );
          })}
        </div>
      </div>

      {/* Shipments List */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-3 pt-2 pb-2 border-b border-slate-800/60 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Shipments</span>
            <span className="text-xs font-mono text-slate-600">
              {search ? `${filteredShipments.length} / ${shipments.length}` : `${shipments.length} total`}
            </span>
          </div>
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, station, priority…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-6 pr-6 py-1 bg-slate-900/50 border border-slate-700/50 rounded text-[11px] font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {shipments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <span className="text-xs font-mono">No shipments yet</span>
            <span className="text-xs text-slate-700">Add one from the New Shipment tab</span>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span className="text-xs font-mono">No matches for "{search}"</span>
          </div>
        ) : (
          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 overflow-y-auto scrollbar-panel p-3 flex flex-col gap-2">
              {filteredShipments.map(s => (
                <ShipmentCard
                  key={s.id}
                  shipment={s}
                  stations={stations}
                  edges={edges}
                  isHighlighted={highlightedShipmentId === s.id}
                  onClick={() => {
                    if (highlightedShipmentId === s.id) {
                      onHighlightPath([], undefined);
                    } else {
                      onHighlightPath(s.path, s.id);
                    }
                  }}
                  onCancel={() => onCancelShipment(s.id)}
                />
              ))}
            </div>
            {/* Fade indicator at bottom to signal more content below */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
}
