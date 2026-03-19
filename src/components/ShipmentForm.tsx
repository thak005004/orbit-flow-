import React, { useState, useMemo } from 'react';
import type { Station, Edge, ShipmentFormData, Priority } from '../types';
import { PRIORITY_CONFIG } from '../types';
import { findOptimalPath } from '../utils/routing';

interface ShipmentFormProps {
  stations: Station[];
  edges: Edge[];
  onAddShipment: (data: ShipmentFormData) => void;
  lastError: string | null;
}

const CARGO_PRESETS = [
  { name: 'Helium-3 Fuel Cells', weight: 120 },
  { name: 'Medical Supplies Crate', weight: 45 },
  { name: 'Mining Equipment', weight: 380 },
  { name: 'Food Rations (30-day)', weight: 85 },
  { name: 'Reactor Components', weight: 250 },
  { name: 'Research Specimens', weight: 30 },
  { name: 'Spacecraft Parts', weight: 560 },
  { name: 'Water Reclamation Unit', weight: 195 },
];

function RoutePreview({
  path,
  stations,
  cost,
  feasible,
  reason,
}: {
  path: string[];
  stations: Station[];
  cost: number;
  feasible: boolean;
  reason?: string;
}) {
  if (path.length === 0 && !reason) return null;

  if (!feasible) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs font-mono text-red-400">NO VIABLE ROUTE</span>
        </div>
        <p className="text-xs text-red-400/70">{reason}</p>
      </div>
    );
  }

  if (path.length < 2) return null;

  const legs = path.length - 1;

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono text-cyan-400">OPTIMAL ROUTE FOUND</span>
        </div>
        <span className="text-xs font-mono text-slate-400">{cost.toFixed(1)} days est.</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {path.map((nodeId, i) => {
          const s = stations.find(st => st.id === nodeId);
          return (
            <React.Fragment key={nodeId}>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50">
                {s?.shortName ?? nodeId}
              </span>
              {i < path.length - 1 && (
                <svg className="w-3 h-3 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
        <span>{legs} leg{legs > 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{path.length} stations</span>
      </div>
    </div>
  );
}

export default function ShipmentForm({ stations, edges, onAddShipment, lastError }: ShipmentFormProps) {
  const [form, setForm] = useState<ShipmentFormData>({
    name: '',
    weight: 100,
    priority: 'medium',
    origin: '',
    destination: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [usePreset, setUsePreset] = useState(false);

  const routePreview = useMemo(() => {
    if (!form.origin || !form.destination || form.origin === form.destination) {
      return null;
    }
    return findOptimalPath(stations, edges, form.origin, form.destination, form.weight);
  }, [form.origin, form.destination, form.weight, stations, edges]);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.origin &&
    form.destination &&
    form.origin !== form.destination &&
    form.weight > 0 &&
    routePreview?.feasible === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAddShipment(form);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    setForm(prev => ({
      ...prev,
      name: '',
      weight: 100,
      priority: 'medium',
    }));
  };

  const applyPreset = (preset: { name: string; weight: number }) => {
    setForm(prev => ({ ...prev, name: preset.name, weight: preset.weight }));
    setUsePreset(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        {/* Cargo Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Cargo Name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Helium-3 Fuel Cells"
              className="flex-1 bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setUsePreset(p => !p)}
              className="px-2 py-2 rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-xs"
              title="Use preset"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>
          {usePreset && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 overflow-hidden">
              {CARGO_PRESETS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-800/60 transition-colors border-b border-slate-800/40 last:border-0"
                >
                  <span className="text-slate-300 font-mono">{p.name}</span>
                  <span className="text-slate-600 font-mono">{p.weight} units</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Weight */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Weight (units)</label>
            <span className="text-sm font-mono text-cyan-400 font-bold">{form.weight}</span>
          </div>
          <input
            type="range"
            min={1}
            max={800}
            step={1}
            value={form.weight}
            onChange={e => setForm(p => ({ ...p, weight: Number(e.target.value) }))}
            className="w-full accent-cyan-500 h-1.5 rounded-full bg-slate-800 appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-700 font-mono">
            <span>1</span>
            <span>200</span>
            <span>400</span>
            <span>600</span>
            <span>800</span>
          </div>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Priority Level</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['low', 'medium', 'high', 'critical'] as Priority[]).map(p => {
              const cfg = PRIORITY_CONFIG[p];
              const isActive = form.priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                  className={`py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                    isActive
                      ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`
                      : 'bg-slate-900/40 border-slate-700/40 text-slate-600 hover:border-slate-600/60'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Origin & Destination */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Origin</label>
            <select
              value={form.origin}
              onChange={e => setForm(p => ({ ...p, origin: e.target.value }))}
              className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-colors font-mono appearance-none cursor-pointer"
            >
              <option value="">Select...</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.shortName}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Destination</label>
            <select
              value={form.destination}
              onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
              className="bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-colors font-mono appearance-none cursor-pointer"
            >
              <option value="">Select...</option>
              {stations
                .filter(s => s.id !== form.origin)
                .map(s => (
                  <option key={s.id} value={s.id}>{s.shortName}</option>
                ))}
            </select>
          </div>
        </div>

        {/* Station capacity hints */}
        {form.origin && (
          <div className="flex flex-col gap-1">
            {[form.origin, form.destination].filter(Boolean).map(id => {
              const st = stations.find(s => s.id === id);
              if (!st) return null;
              const free = st.capacity - st.currentLoad;
              const pct = (st.currentLoad / st.capacity) * 100;
              const color = pct > 85 ? 'text-red-400' : pct > 60 ? 'text-yellow-400' : 'text-green-400';
              return (
                <div key={id} className="flex items-center justify-between text-[10px] font-mono text-slate-600">
                  <span className="text-slate-500">{st.shortName}</span>
                  <span className={color}>{free.toFixed(0)} units free ({(100 - pct).toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Route Preview */}
        {routePreview && (
          <RoutePreview
            path={routePreview.path}
            stations={stations}
            cost={routePreview.cost}
            feasible={routePreview.feasible}
            reason={routePreview.reason}
          />
        )}

        {/* Error */}
        {lastError && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-2 text-xs text-red-400 font-mono">
            {lastError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl font-mono font-bold text-sm transition-all duration-200 ${
            submitted
              ? 'bg-green-600/30 border border-green-500/50 text-green-400'
              : canSubmit
              ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400/60 active:scale-95'
              : 'bg-slate-800/30 border border-slate-700/30 text-slate-600 cursor-not-allowed'
          }`}
        >
          {submitted ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              SHIPMENT DISPATCHED
            </span>
          ) : (
            'DISPATCH SHIPMENT'
          )}
        </button>
      </form>

      {/* Info section */}
      <div className="mx-4 mb-4 rounded-lg border border-slate-800/60 bg-slate-900/20 p-3">
        <p className="text-[10px] text-slate-600 font-mono leading-relaxed">
          The routing engine uses a modified Dijkstra's algorithm that accounts for route capacity constraints and
          congestion weighting. Higher-load routes incur a penalty of up to 1.5× base cost.
        </p>
      </div>
    </div>
  );
}
