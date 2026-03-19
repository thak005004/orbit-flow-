import React, { useMemo, useState } from 'react';
import type { Shipment, Station } from '../types';
import { PRIORITY_CONFIG } from '../types';

interface RouteHistoryProps {
  shipments: Shipment[];
  stations: Station[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatTimeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function efficiencyColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function efficiencyLabel(score: number): string {
  if (score >= 80) return 'OPTIMAL';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  return 'POOR';
}

function DeliveryCard({
  shipment,
  stations,
}: {
  shipment: Shipment;
  stations: Station[];
}) {
  const priorityCfg = PRIORITY_CONFIG[shipment.priority];
  const duration = shipment.deliveredAt ? shipment.deliveredAt - shipment.createdAt : null;
  const deliveredAgo = shipment.deliveredAt ? formatTimeAgo(shipment.deliveredAt) : '—';
  const eColor = efficiencyColor(shipment.efficiencyScore);

  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 flex flex-col gap-2">
      {/* Name + priority + delivered time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white truncate">{shipment.name}</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${priorityCfg.color} ${priorityCfg.bgColor} ${priorityCfg.borderColor}`}>
              {priorityCfg.label}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-600">{deliveredAgo}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] font-mono text-green-400">DELIVERED</span>
        </div>
      </div>

      {/* Route path */}
      <div className="flex items-center gap-1 flex-wrap">
        {shipment.path.map((nodeId, i) => {
          const st = stations.find(s => s.id === nodeId);
          return (
            <React.Fragment key={nodeId}>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/40">
                {st?.shortName ?? nodeId}
              </span>
              {i < shipment.path.length - 1 && (
                <span className="text-[10px] text-slate-700">›</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 flex-wrap">
        <span>{shipment.weight} units</span>
        <span className="text-slate-700">·</span>
        <span className="text-amber-500/80">₡{shipment.fuelCost.toFixed(2)} fuel</span>
        <span className="text-slate-700">·</span>
        <span>{shipment.path.length - 1} hop{shipment.path.length - 1 !== 1 ? 's' : ''}</span>
        {duration !== null && (
          <>
            <span className="text-slate-700">·</span>
            <span>{formatDuration(duration)}</span>
          </>
        )}
      </div>

      {/* Efficiency bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-slate-600 w-14 flex-shrink-0">EFFIC.</span>
        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${shipment.efficiencyScore}%`,
              backgroundColor: eColor,
              boxShadow: `0 0 4px ${eColor}88`,
            }}
          />
        </div>
        <span className="text-[10px] font-mono font-bold w-20 text-right flex-shrink-0" style={{ color: eColor }}>
          {shipment.efficiencyScore}% <span className="font-normal opacity-70">{efficiencyLabel(shipment.efficiencyScore)}</span>
        </span>
      </div>
    </div>
  );
}

export default function RouteHistory({ shipments, stations }: RouteHistoryProps) {
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const delivered = useMemo(
    () =>
      shipments
        .filter(s => s.status === 'delivered')
        .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0)),
    [shipments]
  );

  const filtered = useMemo(() => {
    return delivered.filter(s => {
      const matchSearch = search === '' || s.name.toLowerCase().includes(search.toLowerCase());
      const matchPriority = filterPriority === 'all' || s.priority === filterPriority;
      return matchSearch && matchPriority;
    });
  }, [delivered, search, filterPriority]);

  const totalWeight = useMemo(() => delivered.reduce((sum, s) => sum + s.weight, 0), [delivered]);
  const totalFuel   = useMemo(() => delivered.reduce((sum, s) => sum + s.fuelCost, 0), [delivered]);
  const avgEfficiency = useMemo(() =>
    delivered.length > 0
      ? Math.round(delivered.reduce((sum, s) => sum + s.efficiencyScore, 0) / delivered.length)
      : 0,
    [delivered]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className="p-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Delivery Log</span>
          <span className="text-[10px] font-mono text-slate-600">{delivered.length} completed</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-light rounded-lg border border-slate-700/40 p-2 flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">Cargo</span>
            <span className="text-base font-bold font-mono text-green-400">{totalWeight.toLocaleString()}</span>
            <span className="text-[9px] font-mono text-slate-600">units delivered</span>
          </div>
          <div className="glass-light rounded-lg border border-slate-700/40 p-2 flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">Fuel</span>
            <span className="text-base font-bold font-mono text-amber-400">₡{totalFuel.toFixed(1)}</span>
            <span className="text-[9px] font-mono text-slate-600">total spent</span>
          </div>
          <div className="glass-light rounded-lg border border-slate-700/40 p-2 flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">Avg Eff.</span>
            <span
              className="text-base font-bold font-mono"
              style={{ color: efficiencyColor(avgEfficiency) }}
            >
              {delivered.length > 0 ? `${avgEfficiency}%` : '—'}
            </span>
            <span className="text-[9px] font-mono text-slate-600">efficiency</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-slate-800/60 flex-shrink-0 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search shipments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded px-2 py-1 text-[11px] font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-cyan-500/50"
        />
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="bg-slate-900/60 border border-slate-700/50 rounded px-2 py-1 text-[11px] font-mono text-slate-400 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {delivered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs font-mono">No deliveries yet</span>
            <span className="text-xs text-slate-700">Completed shipments will appear here</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
            <span className="text-xs font-mono">No matches</span>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto scrollbar-panel p-3 flex flex-col gap-2">
            {filtered.map(s => (
              <DeliveryCard key={s.id} shipment={s} stations={stations} />
            ))}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
