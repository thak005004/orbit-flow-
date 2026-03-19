import React, { useState, useEffect, useCallback } from 'react';
import type { Station, Edge, Shipment, ShipmentFormData } from './types';
import { INITIAL_STATIONS, INITIAL_EDGES, createInitialShipments } from './data/initialData';
import { findOptimalPath, advanceShipment, generateId } from './utils/routing';
import GraphView from './components/GraphView';
import Dashboard from './components/Dashboard';
import ShipmentForm from './components/ShipmentForm';

type Tab = 'dashboard' | 'new-shipment';

function Header({
  inTransit,
  delivered,
  stationCount,
}: {
  inTransit: number;
  delivered: number;
  stationCount: number;
}) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-slate-800/80 glass z-10 relative">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="10" stroke="#06b6d4" strokeWidth="1.5" opacity="0.4" />
            <circle cx="14" cy="14" r="5" fill="#06b6d422" stroke="#06b6d4" strokeWidth="1.5" />
            <path d="M14 4 L16 9 L14 8 L12 9 Z" fill="#06b6d4" opacity="0.8" />
            <path d="M24 14 L19 16 L20 14 L19 12 Z" fill="#06b6d4" opacity="0.6" />
            <circle cx="14" cy="14" r="2" fill="#06b6d4" style={{ filter: 'drop-shadow(0 0 4px #06b6d4)' }} />
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold font-mono tracking-wider text-white leading-tight">
            SPACE LOGISTICS
            <span className="text-cyan-400"> ENGINE</span>
          </div>
          <div className="text-[10px] font-mono text-slate-600 tracking-widest">ORBITAL ROUTING SYSTEM v2.4</div>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-4 px-4 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[10px] font-mono text-slate-500">{stationCount} STATIONS</span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-400">{inTransit} IN TRANSIT</span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[10px] font-mono text-slate-500">{delivered} DELIVERED</span>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
          <span className="text-[10px] font-mono text-slate-600">
            {time.toISOString().slice(0, 19).replace('T', ' ')} UTC
          </span>
        </div>
      </div>
    </header>
  );
}

function SidebarTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-slate-800/60">
      {(['dashboard', 'new-shipment'] as Tab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-1 py-3 text-xs font-mono font-medium transition-all uppercase tracking-wider ${
            active === tab
              ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
              : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
          }`}
        >
          {tab === 'dashboard' ? 'Dashboard' : 'New Shipment'}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [shipments, setShipments] = useState<Shipment[]>(() => createInitialShipments());
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [highlightedShipmentId, setHighlightedShipmentId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Simulation tick: advance all in-transit shipments
  useEffect(() => {
    const interval = setInterval(() => {
      setShipments(prev => {
        const updated = prev.map(s => advanceShipment(s, edges));
        // Check for newly delivered shipments and update station/edge loads
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].status === 'delivered' && prev[i].status === 'in-transit') {
            const s = updated[i];
            // Release edge loads
            setEdges(prevEdges =>
              prevEdges.map(e => {
                let edgeOnPath = false;
                for (let j = 0; j < s.path.length - 1; j++) {
                  if (
                    (e.from === s.path[j] && e.to === s.path[j + 1]) ||
                    (e.from === s.path[j + 1] && e.to === s.path[j])
                  ) {
                    edgeOnPath = true;
                    break;
                  }
                }
                return edgeOnPath
                  ? { ...e, currentLoad: Math.max(0, e.currentLoad - s.weight) }
                  : e;
              })
            );
            // Release destination station load
            setStations(prevStations =>
              prevStations.map(st =>
                st.id === s.destination
                  ? { ...st, currentLoad: Math.max(0, st.currentLoad - s.weight) }
                  : st
              )
            );
          }
        }
        return updated;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [edges]);

  const addShipment = useCallback(
    (formData: ShipmentFormData) => {
      setLastError(null);
      const result = findOptimalPath(
        stations,
        edges,
        formData.origin,
        formData.destination,
        formData.weight
      );

      if (!result.feasible) {
        setLastError(result.reason ?? 'No viable route found.');
        return;
      }

      const newShipment: Shipment = {
        id: generateId(),
        name: formData.name,
        weight: formData.weight,
        priority: formData.priority,
        origin: formData.origin,
        destination: formData.destination,
        path: result.path,
        status: 'in-transit',
        createdAt: Date.now(),
        totalCost: result.cost,
        currentLeg: 0,
        legProgress: 0,
      };

      setShipments(prev => [...prev, newShipment]);

      // Increase edge loads along the path
      setEdges(prevEdges =>
        prevEdges.map(e => {
          for (let i = 0; i < result.path.length - 1; i++) {
            if (
              (e.from === result.path[i] && e.to === result.path[i + 1]) ||
              (e.from === result.path[i + 1] && e.to === result.path[i])
            ) {
              return { ...e, currentLoad: e.currentLoad + formData.weight };
            }
          }
          return e;
        })
      );

      // Increase destination station load
      setStations(prevStations =>
        prevStations.map(st =>
          st.id === formData.destination
            ? { ...st, currentLoad: st.currentLoad + formData.weight }
            : st
        )
      );

      setActiveTab('dashboard');
    },
    [stations, edges]
  );

  const handleHighlightPath = useCallback(
    (path: string[], shipmentId?: string) => {
      setHighlightedPath(path);
      setHighlightedShipmentId(shipmentId ?? null);
    },
    []
  );

  const inTransit = shipments.filter(s => s.status === 'in-transit').length;
  const delivered = shipments.filter(s => s.status === 'delivered').length;

  return (
    <div className="h-screen flex flex-col bg-space-950 overflow-hidden">
      <Header inTransit={inTransit} delivered={delivered} stationCount={stations.length} />

      <main className="flex-1 flex overflow-hidden">
        {/* Graph — left panel */}
        <div className="flex-1 relative overflow-hidden">
          <GraphView
            stations={stations}
            edges={edges}
            shipments={shipments}
            selectedStation={selectedStation}
            onSelectStation={setSelectedStation}
            highlightedPath={highlightedPath}
          />
        </div>

        {/* Sidebar — right panel */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-l border-slate-800/80 glass">
          <SidebarTabs active={activeTab} onChange={setActiveTab} />
          <div className="flex-1 overflow-hidden">
            {activeTab === 'dashboard' ? (
              <Dashboard
                stations={stations}
                edges={edges}
                shipments={shipments}
                onHighlightPath={(path, id) => handleHighlightPath(path, id)}
                highlightedShipmentId={highlightedShipmentId}
              />
            ) : (
              <ShipmentForm
                stations={stations}
                edges={edges}
                onAddShipment={addShipment}
                lastError={lastError}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
