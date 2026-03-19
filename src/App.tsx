import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Station, Edge, Shipment, ShipmentFormData, Anomaly, NotificationEntry } from './types';
import { INITIAL_STATIONS, INITIAL_EDGES, createInitialShipments } from './data/initialData';
import { findOptimalPath, advanceShipment, generateId, calculateEfficiencyScore, calculateFuelCost, getDijkstraSteps } from './utils/routing';
import type { DijkstraStep } from './types';
import { detectAnomalies } from './utils/anomalyDetection';
import GraphView from './components/GraphView';
import Dashboard from './components/Dashboard';
import ShipmentForm from './components/ShipmentForm';
import AlertsPanel from './components/AlertsPanel';
import StatsPanel from './components/StatsPanel';
import RouteHistory from './components/RouteHistory';

type Tab = 'dashboard' | 'stats' | 'history' | 'alerts' | 'new-shipment';

function Header({
  inTransit,
  delivered,
  stationCount,
  isDark,
  onToggleTheme,
}: {
  inTransit: number;
  delivered: number;
  stationCount: number;
  isDark: boolean;
  onToggleTheme: () => void;
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

        <button
          onClick={onToggleTheme}
          className="w-8 h-8 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center justify-center hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

function SidebarTabs({
  active,
  onChange,
  alertCount,
  hasCritical,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  alertCount: number;
  hasCritical: boolean;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard',    label: 'Overview'  },
    { id: 'stats',        label: 'Stats'     },
    { id: 'history',      label: 'History'   },
    { id: 'alerts',       label: 'Alerts'    },
    { id: 'new-shipment', label: 'Dispatch'  },
  ];

  return (
    <div className="flex border-b border-slate-800/60">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-3 text-xs font-mono font-medium transition-all uppercase tracking-wider relative ${
            active === tab.id
              ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
              : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
          }`}
        >
          {tab.label}
          {tab.id === 'alerts' && alertCount > 0 && (
            <span
              className={`absolute top-1.5 right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold font-mono flex items-center justify-center ${
                hasCritical
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-orange-500/80 text-white'
              }`}
            >
              {alertCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [shipments, setShipments] = useState<Shipment[]>(() => createInitialShipments());
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [highlightedShipmentId, setHighlightedShipmentId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);

  // ── Dijkstra visualiser ────────────────────────────────────────────────────
  const [vizSteps, setVizSteps] = useState<DijkstraStep[]>([]);
  const [vizIndex, setVizIndex] = useState(0);
  const [vizPlaying, setVizPlaying] = useState(false);
  const [vizSpeed, setVizSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');

  // Derive active anomalies fresh every render — no extra state needed.
  const activeAnomalies = useMemo(
    () => detectAnomalies(stations, edges),
    [stations, edges]
  );

  // Track the previous anomaly map so we can detect transitions (new / resolved / escalated).
  const prevAnomaliesRef = useRef<Map<string, Anomaly>>(new Map());
  useEffect(() => {
    const currentMap = new Map(activeAnomalies.map(a => [a.id, a]));
    const prev = prevAnomaliesRef.current;
    const newEntries: NotificationEntry[] = [];

    // New anomalies or severity escalations
    for (const a of activeAnomalies) {
      const prevA = prev.get(a.id);
      if (!prevA || prevA.type !== a.type) {
        newEntries.push({
          id: generateId(),
          anomalyId: a.id,
          type: a.type,
          message: a.message,
          timestamp: Date.now(),
        });
      }
    }

    // Resolved anomalies
    for (const [id, prevA] of prev) {
      if (!currentMap.has(id)) {
        newEntries.push({
          id: generateId(),
          anomalyId: id,
          type: 'resolved',
          message: `${prevA.entityName} returned to normal`,
          timestamp: Date.now(),
        });
      }
    }

    if (newEntries.length > 0) {
      setNotifications(prev => [...newEntries, ...prev].slice(0, 200));
    }

    prevAnomaliesRef.current = currentMap;
  }, [activeAnomalies]);

  // Keep a ref to edges so the tick closure always sees the latest value
  // without needing to restart the interval every time edge loads change.
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Simulation tick — pure advancement only, no side-effects inside updater.
  // Empty deps: interval is created once and never restarted.
  useEffect(() => {
    const interval = setInterval(() => {
      setShipments(prev => prev.map(s => advanceShipment(s, edgesRef.current)));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Delivery cleanup — separate effect watches shipments and releases
  // edge/station loads when a shipment transitions to 'delivered'.
  const prevShipmentsRef = useRef<Shipment[]>([]);
  useEffect(() => {
    const prevMap = new Map(prevShipmentsRef.current.map(s => [s.id, s]));
    const newlyDelivered = shipments.filter(
      s => s.status === 'delivered' && prevMap.get(s.id)?.status === 'in-transit'
    );

    if (newlyDelivered.length > 0) {
      setEdges(prevEdges => {
        let next = prevEdges;
        for (const s of newlyDelivered) {
          next = next.map(e => {
            const onPath = s.path.some((nodeId, i) =>
              i < s.path.length - 1 &&
              ((e.from === nodeId && e.to === s.path[i + 1]) ||
               (e.from === s.path[i + 1] && e.to === nodeId))
            );
            return onPath ? { ...e, currentLoad: Math.max(0, e.currentLoad - s.weight) } : e;
          });
        }
        return next;
      });

      setStations(prevStations => {
        let next = prevStations;
        for (const s of newlyDelivered) {
          next = next.map(st =>
            st.id === s.destination
              ? { ...st, currentLoad: Math.max(0, st.currentLoad - s.weight) }
              : st
          );
        }
        return next;
      });
    }

    prevShipmentsRef.current = shipments;
  }, [shipments]);

  // Advance viz one step at the configured speed
  const VIZ_SPEED_MS = { slow: 700, normal: 220, fast: 55 } as const;
  useEffect(() => {
    if (!vizPlaying || vizIndex >= vizSteps.length - 1) {
      if (vizPlaying && vizIndex >= vizSteps.length - 1) setVizPlaying(false);
      return;
    }
    const t = setTimeout(() => setVizIndex(i => i + 1), VIZ_SPEED_MS[vizSpeed]);
    return () => clearTimeout(t);
  }, [vizPlaying, vizIndex, vizSteps.length, vizSpeed]);

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
        efficiencyScore: calculateEfficiencyScore(
          result.path, formData.weight, formData.priority, edges
        ),
        fuelCost: calculateFuelCost(result.path, formData.weight, edges),
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

      if (shipmentId) {
        const shipment = shipments.find(s => s.id === shipmentId);
        if (shipment) {
          const steps = getDijkstraSteps(stations, edges, shipment.origin, shipment.destination, shipment.weight);
          setVizSteps(steps);
          setVizIndex(0);
          setVizPlaying(true);
        }
      } else {
        // Deselected — stop viz
        setVizSteps([]);
        setVizIndex(0);
        setVizPlaying(false);
      }
    },
    [shipments, stations, edges]
  );

  const inTransit = shipments.filter(s => s.status === 'in-transit').length;
  const delivered = shipments.filter(s => s.status === 'delivered').length;

  const currentVizStep = vizSteps.length > 0 ? vizSteps[vizIndex] : null;
  // During viz, suppress the yellow shipment-path highlight; GraphView uses vizStep.finalPath for cyan
  const effectiveHighlightedPath = vizSteps.length > 0 ? [] : highlightedPath;
  const anomalyEntityIds = useMemo(
    () => new Set(activeAnomalies.map(a => a.entityId)),
    [activeAnomalies]
  );
  const hasCritical = activeAnomalies.some(a => a.type === 'critical');

  return (
    <div className="h-screen flex flex-col bg-space-950 overflow-hidden">
      <Header inTransit={inTransit} delivered={delivered} stationCount={stations.length} isDark={isDark} onToggleTheme={() => setIsDark(d => !d)} />

      <main className="flex-1 flex overflow-hidden">
        {/* Graph — left panel */}
        <div className="flex-1 relative overflow-hidden">
          <GraphView
            stations={stations}
            edges={edges}
            shipments={shipments}
            selectedStation={selectedStation}
            onSelectStation={setSelectedStation}
            highlightedPath={effectiveHighlightedPath}
            anomalyEntityIds={anomalyEntityIds}
            vizStep={currentVizStep}
            vizPlaying={vizPlaying}
            vizSpeed={vizSpeed}
            vizStepIndex={vizIndex}
            vizTotalSteps={vizSteps.length}
            onVizTogglePlay={() => setVizPlaying(p => !p)}
            onVizSpeedChange={setVizSpeed}
            onVizReplay={() => { setVizIndex(0); setVizPlaying(true); }}
            onVizStepForward={() => setVizIndex(i => Math.min(i + 1, vizSteps.length - 1))}
            onVizStepBack={() => setVizIndex(i => Math.max(i - 1, 0))}
            isDark={isDark}
          />
        </div>

        {/* Sidebar — right panel */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-l border-slate-800/80 glass">
          <SidebarTabs
            active={activeTab}
            onChange={setActiveTab}
            alertCount={activeAnomalies.length}
            hasCritical={hasCritical}
          />
          <div className="flex-1 overflow-hidden">
            {activeTab === 'dashboard' && (
              <Dashboard
                stations={stations}
                edges={edges}
                shipments={shipments}
                onHighlightPath={(path, id) => handleHighlightPath(path, id)}
                highlightedShipmentId={highlightedShipmentId}
              />
            )}
            {activeTab === 'stats' && (
              <StatsPanel
                shipments={shipments}
                edges={edges}
                stations={stations}
              />
            )}
            {activeTab === 'history' && (
              <RouteHistory
                shipments={shipments}
                stations={stations}
              />
            )}
            {activeTab === 'alerts' && (
              <AlertsPanel
                activeAnomalies={activeAnomalies}
                notifications={notifications}
                onClearNotifications={() => setNotifications([])}
              />
            )}
            {activeTab === 'new-shipment' && (
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
