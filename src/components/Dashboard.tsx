import React, { useMemo } from 'react';
import type { Station, Edge, Shipment } from '../types';
import { PRIORITY_CONFIG, STATUS_CONFIG, TYPE_CONFIG } from '../types';

interface DashboardProps {
  stations: Station[];
  edges: Edge[];
  shipments: Shipment[];
  onHighlightPath: (path: string[], id?: string) => void;
  highlightedShipmentId: string | null;
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

function ShipmentCard({
  shipment,
  stations,
  isHighlighted,
  onClick,
}: {
  shipment: Shipment;
  stations: Station[];
  isHighlighted: boolean;
  onClick: () => void;
}) {
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
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-white truncate">{shipment.name}</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${priorityCfg.color} ${priorityCfg.bgColor} ${priorityCfg.borderColor}`}>
              {priorityCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
            <span>{origin?.shortName ?? '?'}</span>
            <span className="text-slate-600">→</span>
            <span>{dest?.shortName ?? '?'}</span>
            <span className="text-slate-700 ml-1">·</span>
            <span>{shipment.weight} units</span>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono ${statusCfg.color} ${statusCfg.bgColor} border-slate-700/30`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${shipment.status === 'in-transit' ? 'animate-pulse' : ''}`} />
          {statusCfg.label}
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

      {shipment.status === 'in-transit' && (
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-600 font-mono">
          <span>Leg {shipment.currentLeg + 1}/{shipment.path.length - 1}</span>
          <span>·</span>
          <span>Cost: {shipment.totalCost.toFixed(1)}d</span>
          <span>·</span>
          <span>{elapsed}s ago</span>
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

  const sortedShipments = useMemo(() => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder: Record<string, number> = { 'in-transit': 0, pending: 1, delivered: 2, failed: 3 };
    return [...shipments].sort((a, b) => {
      const sd = statusOrder[a.status] - statusOrder[b.status];
      if (sd !== 0) return sd;
      return order[a.priority] - order[b.priority];
    });
  }, [shipments]);

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
      <div className="p-3 border-b border-slate-800/60">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest block mb-2">Depot Capacity</span>
        <div className="flex flex-col gap-2">
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
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Shipments
          </span>
          <span className="text-xs font-mono text-slate-600">{shipments.length} total</span>
        </div>

        {shipments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <span className="text-xs font-mono">No shipments yet</span>
            <span className="text-xs text-slate-700">Add one from the New Shipment tab</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {sortedShipments.map(s => (
              <ShipmentCard
                key={s.id}
                shipment={s}
                stations={stations}
                isHighlighted={highlightedShipmentId === s.id}
                onClick={() => {
                  if (highlightedShipmentId === s.id) {
                    onHighlightPath([], undefined);
                  } else {
                    onHighlightPath(s.path, s.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
