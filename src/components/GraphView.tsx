import React, { useMemo, useState } from 'react';
import type { Station, Edge, Shipment, DijkstraStep } from '../types';
import { TYPE_CONFIG, PRIORITY_CONFIG } from '../types';
import { getShipmentPosition, isEdgeActive, isEdgeInPath } from '../utils/routing';

type VizNodeState = 'current' | 'visited' | 'frontier' | 'path' | null;

interface GraphViewProps {
  stations: Station[];
  edges: Edge[];
  shipments: Shipment[];
  selectedStation: string | null;
  onSelectStation: (id: string | null) => void;
  highlightedPath: string[];
  anomalyEntityIds: Set<string>;
  vizStep?: DijkstraStep | null;
  vizPlaying?: boolean;
  vizSpeed?: 'slow' | 'normal' | 'fast';
  vizStepIndex?: number;
  vizTotalSteps?: number;
  onVizTogglePlay?: () => void;
  onVizSpeedChange?: (s: 'slow' | 'normal' | 'fast') => void;
  onVizReplay?: () => void;
  onVizStepForward?: () => void;
  onVizStepBack?: () => void;
  isDark?: boolean;
}

// Stable random stars
const STARS = Array.from({ length: 180 }, (_, i) => {
  const seed = i * 2654435761;
  return {
    id: i,
    x: ((seed * 1234567) & 0xffff) / 65535 * 1200,
    y: ((seed * 7654321) & 0xffff) / 65535 * 700,
    r: ((seed * 9999991) & 0xffff) / 65535 * 1.4 + 0.4,
    op: ((seed * 1111111) & 0xffff) / 65535 * 0.6 + 0.2,
  };
});

// Grid lines for the space map feel
function GridLines({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? 'rgba(30,58,92,0.15)' : 'rgba(100,116,139,0.12)';
  const lines = [];
  for (let x = 0; x <= 1200; x += 80) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={700} stroke={stroke} strokeWidth={1} />);
  }
  for (let y = 0; y <= 700; y += 80) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={1200} y2={y} stroke={stroke} strokeWidth={1} />);
  }
  return <>{lines}</>;
}

const VIZ_COLORS: Record<NonNullable<VizNodeState>, string> = {
  current:  '#ffffff',
  visited:  '#10b981',
  frontier: '#f59e0b',
  path:     '#06b6d4',
};

function StationNode({
  station,
  isSelected,
  isHighlighted,
  isOnActivePath,
  isAnomalous,
  vizState,
  onClick,
  onHover,
}: {
  station: Station;
  isSelected: boolean;
  isHighlighted: boolean;
  isOnActivePath: boolean;
  isAnomalous: boolean;
  vizState: VizNodeState;
  onClick: (e: React.MouseEvent<SVGGElement>) => void;
  onHover: (id: string | null) => void;
}) {
  const config = TYPE_CONFIG[station.type];
  const loadPct = station.currentLoad / station.capacity;
  const loadColor = loadPct > 0.85 ? '#ef4444' : loadPct > 0.6 ? '#f59e0b' : '#10b981';
  const isCritical = loadPct >= 0.95;

  const radius = station.type === 'hub' ? 22 : station.type === 'gateway' ? 20 : station.type === 'depot' ? 18 : 15;
  const glowRadius = radius + 8;
  const labelY = station.y + radius + 16;

  const vizColor = vizState ? VIZ_COLORS[vizState] : null;
  const borderColor = vizColor ?? (isAnomalous ? (isCritical ? '#ef4444' : '#f97316') : config.color);
  const isVizActive = vizState !== null;

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => onHover(station.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Viz state ring */}
      {vizState === 'current' && (
        <circle
          cx={station.x} cy={station.y}
          r={glowRadius + 14}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          opacity={0.9}
          className="node-pulse"
          style={{ filter: 'drop-shadow(0 0 12px #ffffff)' }}
        />
      )}
      {vizState === 'frontier' && (
        <circle
          cx={station.x} cy={station.y}
          r={glowRadius + 10}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.5}
          opacity={0.7}
          className="node-pulse"
          style={{ filter: 'drop-shadow(0 0 8px #f59e0b)' }}
        />
      )}
      {vizState === 'visited' && (
        <circle
          cx={station.x} cy={station.y}
          r={glowRadius + 6}
          fill="#10b98118"
          stroke="#10b981"
          strokeWidth={1}
          opacity={0.5}
        />
      )}
      {vizState === 'path' && (
        <circle
          cx={station.x} cy={station.y}
          r={glowRadius + 12}
          fill="none"
          stroke="#06b6d4"
          strokeWidth={2}
          opacity={0.8}
          className="node-pulse"
          style={{ filter: 'drop-shadow(0 0 10px #06b6d4)' }}
        />
      )}

      {/* Anomaly warning ring */}
      {isAnomalous && !isVizActive && (
        <circle
          cx={station.x} cy={station.y}
          r={glowRadius + 10}
          fill="none"
          stroke={isCritical ? '#ef4444' : '#f97316'}
          strokeWidth={2}
          opacity={0.6}
          className="node-pulse"
          style={{ filter: `drop-shadow(0 0 8px ${isCritical ? '#ef4444' : '#f97316'})` }}
        />
      )}

      {/* Outer glow ring (selected / on-path) */}
      {(isSelected || isHighlighted || isOnActivePath) && !isVizActive && (
        <circle
          cx={station.x} cy={station.y}
          r={glowRadius + 6}
          fill="none"
          stroke={config.color}
          strokeWidth={1.5}
          opacity={0.4}
          className="node-pulse"
        />
      )}

      {/* Orbit ring */}
      <circle
        cx={station.x} cy={station.y}
        r={glowRadius}
        fill="none"
        stroke={borderColor}
        strokeWidth={isVizActive || isSelected || isHighlighted || isAnomalous ? 1.5 : 0.8}
        opacity={isVizActive || isSelected || isHighlighted || isAnomalous ? 0.7 : 0.3}
        strokeDasharray={isSelected ? '4 2' : 'none'}
      />

      {/* Main node body */}
      <circle
        cx={station.x} cy={station.y}
        r={radius}
        fill={vizColor ? `${vizColor}22` : isAnomalous ? `${borderColor}33` : `${config.color}22`}
        stroke={borderColor}
        strokeWidth={isVizActive || isSelected || isHighlighted || isAnomalous ? 2.5 : 1.5}
        style={{
          filter: `drop-shadow(0 0 ${isVizActive || isSelected || isAnomalous ? 14 : 6}px ${borderColor}88)`,
        }}
      />

      {/* Inner highlight */}
      <circle
        cx={station.x - radius * 0.25}
        cy={station.y - radius * 0.25}
        r={radius * 0.3}
        fill={`${config.color}40`}
      />

      {/* Station short name */}
      <text
        x={station.x} y={station.y + 4}
        textAnchor="middle"
        fontSize={8}
        fill={vizColor ?? config.color}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {station.shortName}
      </text>

      {/* Station full name label */}
      <text
        x={station.x} y={labelY}
        textAnchor="middle"
        fontSize={9.5}
        fill={isVizActive || isSelected || isHighlighted ? 'white' : '#94a3b8'}
        fontFamily="system-ui"
        style={{ fontWeight: isVizActive || isSelected || isHighlighted ? '600' : '400' }}
      >
        {station.name}
      </text>

      {/* Capacity bar */}
      <rect x={station.x - 18} y={labelY + 5} width={36} height={3} rx={1.5} fill="#1e3a5f" />
      <rect
        x={station.x - 18} y={labelY + 5}
        width={36 * loadPct} height={3} rx={1.5}
        fill={loadColor}
        style={{ filter: `drop-shadow(0 0 3px ${loadColor})` }}
      />
    </g>
  );
}

function EdgeLine({
  edge,
  from,
  to,
  isActive,
  isHighlighted,
  isAnomalous,
  isVizPath,
  vizDimmed,
}: {
  edge: Edge;
  from: Station;
  to: Station;
  isActive: boolean;
  isHighlighted: boolean;
  isAnomalous: boolean;
  isVizPath: boolean;
  vizDimmed: boolean;
}) {
  const loadPct = edge.maxCapacity > 0 ? edge.currentLoad / edge.maxCapacity : 0;
  const isCritical = loadPct >= 0.95;
  const anyLit = isHighlighted || isVizPath || isActive || isAnomalous;
  const baseOpacity = vizDimmed ? 0.08 : anyLit ? 1 : 0.25;
  const strokeColor = isVizPath
    ? '#06b6d4'
    : isHighlighted
    ? '#facc15'
    : isAnomalous
    ? (isCritical ? '#ef4444' : '#f97316')
    : isActive
    ? '#06b6d4'
    : '#1e3a5f';

  // Midpoint for label
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;

  return (
    <g>
      {/* Background line */}
      <line
        x1={from.x} y1={from.y}
        x2={to.x} y2={to.y}
        stroke="#0a1628"
        strokeWidth={4}
      />

      {/* Main edge line */}
      <line
        x1={from.x} y1={from.y}
        x2={to.x} y2={to.y}
        stroke={strokeColor}
        strokeWidth={isVizPath ? 3 : isHighlighted ? 2.5 : isAnomalous ? 2 : isActive ? 2 : 1}
        opacity={baseOpacity}
        strokeDasharray={isAnomalous ? '6 3' : isActive ? '8 4' : (isHighlighted || isVizPath) ? '6 3' : 'none'}
        className={isActive || isAnomalous || isVizPath ? 'route-dash' : ''}
        style={
          anyLit
            ? { filter: `drop-shadow(0 0 ${isAnomalous ? 6 : isVizPath ? 8 : 4}px ${strokeColor})` }
            : undefined
        }
      />

      {/* Load bar overlay */}
      {loadPct > 0 && (
        <line
          x1={from.x} y1={from.y}
          x2={from.x + (to.x - from.x) * loadPct}
          y2={from.y + (to.y - from.y) * loadPct}
          stroke="#f59e0b"
          strokeWidth={1}
          opacity={0.4}
        />
      )}

      {/* Cost label — shown when highlighted, viz-path, or active */}
      {(isHighlighted || isVizPath || isActive) && (
        <>
          <rect
            x={mx - 18} y={my - 9}
            width={36} height={14}
            rx={3}
            fill="#0a1628"
            stroke={isHighlighted ? '#facc1580' : '#06b6d480'}
            strokeWidth={1}
          />
          <text
            x={mx} y={my + 1}
            textAnchor="middle"
            fontSize={7.5}
            fill={isHighlighted ? '#facc15' : '#06b6d4'}
            fontFamily="monospace"
          >
            {edge.cost.toFixed(1)}d · {(edge.distanceAU).toFixed(2)}AU
          </text>
        </>
      )}
    </g>
  );
}

function ShipmentDot({
  shipment,
  stations,
}: {
  shipment: Shipment;
  stations: Station[];
}) {
  const pos = getShipmentPosition(shipment, stations);
  if (!pos) return null;

  const dotColor = PRIORITY_CONFIG[shipment.priority].dotColor;

  return (
    <g>
      {/* Glow ring */}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={8}
        fill="none"
        stroke={dotColor}
        strokeWidth={1}
        opacity={0.4}
      />
      {/* Dot */}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={4}
        fill={dotColor}
        style={{ filter: `drop-shadow(0 0 6px ${dotColor})` }}
      />
    </g>
  );
}

function TooltipOverlay({
  station,
  stations,
}: {
  station: Station;
  stations: Station[];
}) {
  const config = TYPE_CONFIG[station.type];
  const loadPct = (station.currentLoad / station.capacity) * 100;
  const free = station.capacity - station.currentLoad;

  // Position tooltip to avoid edges
  const tipX = station.x > 800 ? station.x - 200 : station.x + 30;
  const tipY = station.y > 500 ? station.y - 120 : station.y - 10;

  return (
    <g>
      <rect
        x={tipX}
        y={tipY}
        width={190}
        height={110}
        rx={6}
        fill="#020817"
        stroke={config.color}
        strokeWidth={1}
        opacity={0.95}
        style={{ filter: `drop-shadow(0 4px 16px rgba(0,0,0,0.8))` }}
      />
      <text x={tipX + 10} y={tipY + 18} fontSize={9} fill={config.color} fontFamily="monospace" fontWeight="bold">
        {station.shortName} — {station.name}
      </text>
      <text x={tipX + 10} y={tipY + 33} fontSize={8} fill="#64748b" fontFamily="system-ui">
        {config.label} · {station.region}
      </text>
      <text x={tipX + 10} y={tipY + 50} fontSize={7.5} fill="#94a3b8" fontFamily="system-ui">
        {station.description.slice(0, 55)}...
      </text>
      <text x={tipX + 10} y={tipY + 68} fontSize={8} fill="#64748b" fontFamily="monospace">
        CAPACITY
      </text>
      <rect x={tipX + 10} y={tipY + 74} width={170} height={5} rx={2.5} fill="#1e3a5f" />
      <rect
        x={tipX + 10} y={tipY + 74}
        width={170 * (loadPct / 100)} height={5}
        rx={2.5}
        fill={loadPct > 85 ? '#ef4444' : loadPct > 60 ? '#f59e0b' : '#10b981'}
      />
      <text x={tipX + 10} y={tipY + 96} fontSize={8} fill="#94a3b8" fontFamily="monospace">
        {station.currentLoad.toFixed(0)} / {station.capacity} units ({loadPct.toFixed(0)}%)
      </text>
      <text x={tipX + 130} y={tipY + 96} fontSize={8} fill="#64748b" fontFamily="monospace">
        {free.toFixed(0)} free
      </text>
    </g>
  );
}

export default function GraphView({
  stations,
  edges,
  shipments,
  selectedStation,
  onSelectStation,
  highlightedPath,
  anomalyEntityIds,
  vizStep = null,
  vizPlaying = false,
  vizSpeed = 'normal',
  vizStepIndex = 0,
  vizTotalSteps = 0,
  onVizTogglePlay,
  onVizSpeedChange,
  onVizReplay,
  onVizStepForward,
  onVizStepBack,
  isDark = true,
}: GraphViewProps) {
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);

  const activeShipments = useMemo(
    () => shipments.filter(s => s.status === 'in-transit'),
    [shipments]
  );

  // Compute per-node viz state from current step
  const vizVisited  = useMemo(() => new Set(vizStep?.visitedNodes  ?? []), [vizStep]);
  const vizFrontier = useMemo(() => new Set(vizStep?.frontierNodes ?? []), [vizStep]);
  const vizPathSet  = useMemo(() => new Set(vizStep?.finalPath     ?? []), [vizStep]);
  const vizCurrentNode = vizStep?.currentNode ?? null;

  const getVizState = (id: string): VizNodeState => {
    if (!vizStep) return null;
    if (vizPathSet.has(id))     return 'path';
    if (id === vizCurrentNode)  return 'current';
    if (vizVisited.has(id))     return 'visited';
    if (vizFrontier.has(id))    return 'frontier';
    return null;
  };

  const vizFinalPath = vizStep?.finalPath ?? null;
  // Dim all edges while viz is running and path not yet revealed
  const vizExploring = vizStep !== null && vizFinalPath === null;

  const tooltipStation = hoveredStation ? stations.find(s => s.id === hoveredStation) : null;

  return (
    <div className="relative w-full h-full bg-space-950 scanlines overflow-hidden">
      <svg
        viewBox="0 0 1200 700"
        className="w-full h-full"
        onClick={() => onSelectStation(null)}
      >
        <defs>
          <radialGradient id="bg-gradient" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={isDark ? '#0a1628' : '#ccd9e8'} />
            <stop offset="100%" stopColor={isDark ? '#020817' : '#b8cfe0'} />
          </radialGradient>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={1200} height={700} fill="url(#bg-gradient)" />

        {/* Grid */}
        <GridLines isDark={isDark} />

        {/* Stars */}
        {STARS.map(s => (
          <circle key={s.id} cx={s.x} cy={s.y} r={s.r}
            fill={isDark ? 'white' : '#475569'}
            opacity={isDark ? s.op : s.op * 0.3}
          />
        ))}

        {/* Region labels */}
        {(() => {
          const regionColor = isDark ? '#1e3a5f' : '#64748b';
          const sepColor    = isDark ? '#1e3a5f' : '#94a3b8';
          return (
            <>
              <text x={140} y={560} fontSize={9} fill={regionColor} fontFamily="monospace" letterSpacing="3">INNER SYSTEM</text>
              <text x={580} y={570} fontSize={9} fill={regionColor} fontFamily="monospace" letterSpacing="3">ASTEROID BELT</text>
              <text x={950} y={560} fontSize={9} fill={regionColor} fontFamily="monospace" letterSpacing="3">OUTER SYSTEM</text>
              <line x1={560} y1={40} x2={560} y2={660} stroke={sepColor} strokeWidth={0.5} strokeDasharray="4 6" opacity={0.5} />
              <line x1={840} y1={40} x2={840} y2={660} stroke={sepColor} strokeWidth={0.5} strokeDasharray="4 6" opacity={0.5} />
            </>
          );
        })()}

        {/* Edges */}
        {edges.map(edge => {
          const from = stations.find(s => s.id === edge.from);
          const to = stations.find(s => s.id === edge.to);
          if (!from || !to) return null;

          const onVizFinalPath = vizFinalPath !== null && isEdgeInPath(edge, vizFinalPath);
          return (
            <EdgeLine
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              isActive={isEdgeActive(edge, activeShipments)}
              isHighlighted={isEdgeInPath(edge, highlightedPath)}
              isAnomalous={anomalyEntityIds.has(edge.id)}
              isVizPath={onVizFinalPath}
              vizDimmed={vizExploring && !onVizFinalPath}
            />
          );
        })}

        {/* Station nodes */}
        {stations.map(station => (
          <StationNode
            key={station.id}
            station={station}
            isSelected={selectedStation === station.id}
            isHighlighted={highlightedPath.includes(station.id)}
            isOnActivePath={activeShipments.some(s => s.path?.includes(station.id))}
            isAnomalous={anomalyEntityIds.has(station.id)}
            vizState={getVizState(station.id)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectStation(station.id === selectedStation ? null : station.id);
            }}
            onHover={setHoveredStation}
          />
        ))}

        {/* Shipment dots */}
        {activeShipments.map(s => (
          <ShipmentDot key={s.id} shipment={s} stations={stations} />
        ))}

        {/* Tooltip */}
        {tooltipStation && (
          <TooltipOverlay station={tooltipStation} stations={stations} />
        )}

        {/* Legend */}
        <g transform="translate(20, 20)">
          <rect width={130} height={130} rx={6} fill={isDark ? '#020817' : '#ffffff'} stroke={isDark ? '#1e3a5f' : '#cbd5e1'} strokeWidth={1} opacity={0.9} />
          <text x={10} y={18} fontSize={8} fill={isDark ? '#334155' : '#64748b'} fontFamily="monospace" letterSpacing="1">STATION TYPES</text>
          {Object.entries(TYPE_CONFIG).map(([type, cfg], i) => (
            <g key={type} transform={`translate(10, ${30 + i * 18})`}>
              <circle cx={6} cy={0} r={5} fill={`${cfg.color}22`} stroke={cfg.color} strokeWidth={1.5} />
              <text x={16} y={4} fontSize={8} fill="#94a3b8" fontFamily="system-ui">{cfg.label}</text>
            </g>
          ))}
        </g>

        {/* Active shipments counter */}
        {activeShipments.length > 0 && (
          <g transform="translate(20, 170)">
            <rect width={130} height={35} rx={6} fill="#020817" stroke="#06b6d480" strokeWidth={1} opacity={0.9} />
            <circle cx={14} cy={17} r={5} fill="#06b6d4" opacity={0.9}
              style={{ filter: 'drop-shadow(0 0 4px #06b6d4)' }} />
            <text x={24} y={13} fontSize={8} fill="#06b6d4" fontFamily="monospace">ACTIVE SHIPMENTS</text>
            <text x={24} y={24} fontSize={10} fill="white" fontFamily="monospace" fontWeight="bold">
              {activeShipments.length} in transit
            </text>
          </g>
        )}
      </svg>

      {/* ── Dijkstra visualiser control panel ────────────────────────────── */}
      {vizTotalSteps > 0 && (
        <div className="absolute bottom-4 left-4 glass border border-slate-700/60 rounded-xl p-3 flex flex-col gap-2.5 min-w-[280px] shadow-2xl">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px #06b6d4' }} />
              <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest uppercase">
                Dijkstra Pathfinding
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              step <span className="text-slate-300">{vizStepIndex + 1}</span>/{vizTotalSteps}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${((vizStepIndex + 1) / vizTotalSteps) * 100}%`,
                background: vizFinalPath ? 'linear-gradient(90deg,#0891b2,#06b6d4)' : 'linear-gradient(90deg,#d97706,#f59e0b)',
                boxShadow: vizFinalPath ? '0 0 6px #06b6d488' : '0 0 6px #f59e0b88',
              }}
            />
          </div>

          {/* Phase label */}
          <div className="text-[10px] font-mono text-slate-500 text-center -mt-1">
            {vizFinalPath
              ? <span className="text-cyan-400">✓ Optimal path found — {vizFinalPath.length - 1} hops</span>
              : vizCurrentNode
              ? <span className="text-amber-400">Examining node…</span>
              : <span className="text-slate-500">Initialising frontier</span>}
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={onVizReplay}
              className="px-2 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-white border border-slate-700/60 hover:border-slate-500 transition-colors"
              title="Restart"
            >⟳</button>
            <button
              onClick={onVizStepBack}
              disabled={vizStepIndex === 0}
              className="px-2.5 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-white border border-slate-700/60 hover:border-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >◀</button>
            <button
              onClick={onVizTogglePlay}
              className={`px-4 py-1 rounded text-[10px] font-mono font-bold border transition-colors ${
                vizPlaying
                  ? 'text-amber-400 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20'
              }`}
            >
              {vizPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
            </button>
            <button
              onClick={onVizStepForward}
              disabled={vizStepIndex >= vizTotalSteps - 1}
              className="px-2.5 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-white border border-slate-700/60 hover:border-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >▶</button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1 justify-center">
            <span className="text-[9px] font-mono text-slate-600 mr-1">SPEED</span>
            {(['slow', 'normal', 'fast'] as const).map(s => (
              <button
                key={s}
                onClick={() => onVizSpeedChange?.(s)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide transition-colors border ${
                  vizSpeed === s
                    ? 'text-cyan-400 border-cyan-500/60 bg-cyan-500/10'
                    : 'text-slate-600 border-slate-700/40 hover:text-slate-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-3 pt-0.5 border-t border-slate-800/60">
            {[
              { color: '#ffffff', label: 'Examining' },
              { color: '#f59e0b', label: 'Frontier' },
              { color: '#10b981', label: 'Visited' },
              { color: '#06b6d4', label: 'Path' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
                <span className="text-[9px] font-mono text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
