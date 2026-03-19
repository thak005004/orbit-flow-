import React, { useMemo, useState } from 'react';
import type { Station, Edge, Shipment } from '../types';
import { TYPE_CONFIG, PRIORITY_CONFIG } from '../types';
import { getShipmentPosition, isEdgeActive, isEdgeInPath } from '../utils/routing';

interface GraphViewProps {
  stations: Station[];
  edges: Edge[];
  shipments: Shipment[];
  selectedStation: string | null;
  onSelectStation: (id: string | null) => void;
  highlightedPath: string[];
  anomalyEntityIds: Set<string>;
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
function GridLines() {
  const lines = [];
  for (let x = 0; x <= 1200; x += 80) {
    lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={700} stroke="rgba(30,58,92,0.15)" strokeWidth={1} />);
  }
  for (let y = 0; y <= 700; y += 80) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={1200} y2={y} stroke="rgba(30,58,92,0.15)" strokeWidth={1} />);
  }
  return <>{lines}</>;
}

function StationNode({
  station,
  isSelected,
  isHighlighted,
  isOnActivePath,
  isAnomalous,
  onClick,
  onHover,
}: {
  station: Station;
  isSelected: boolean;
  isHighlighted: boolean;
  isOnActivePath: boolean;
  isAnomalous: boolean;
  onClick: (e: React.MouseEvent<SVGGElement>) => void;
  onHover: (id: string | null) => void;
}) {
  const config = TYPE_CONFIG[station.type];
  const loadPct = station.currentLoad / station.capacity;
  const loadColor = loadPct > 0.85 ? '#ef4444' : loadPct > 0.6 ? '#f59e0b' : '#10b981';
  const isCritical = loadPct >= 0.95;

  // Radius based on type importance
  const radius = station.type === 'hub' ? 22 : station.type === 'gateway' ? 20 : station.type === 'depot' ? 18 : 15;
  const glowRadius = radius + 8;
  const labelY = station.y + radius + 16;

  const borderColor = isAnomalous ? (isCritical ? '#ef4444' : '#f97316') : config.color;

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => onHover(station.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Anomaly warning ring — pulsing red/orange */}
      {isAnomalous && (
        <circle
          cx={station.x}
          cy={station.y}
          r={glowRadius + 10}
          fill="none"
          stroke={isCritical ? '#ef4444' : '#f97316'}
          strokeWidth={2}
          opacity={0.6}
          className="node-pulse"
          style={{ filter: `drop-shadow(0 0 8px ${isCritical ? '#ef4444' : '#f97316'})` }}
        />
      )}

      {/* Outer glow when selected or highlighted */}
      {(isSelected || isHighlighted || isOnActivePath) && (
        <circle
          cx={station.x}
          cy={station.y}
          r={glowRadius + 6}
          fill="none"
          stroke={config.color}
          strokeWidth={1.5}
          opacity={0.4}
          style={{ animation: 'node-pulse-anim 2s ease-out infinite' }}
          className="node-pulse"
        />
      )}

      {/* Orbit ring */}
      <circle
        cx={station.x}
        cy={station.y}
        r={glowRadius}
        fill="none"
        stroke={borderColor}
        strokeWidth={isSelected || isHighlighted || isAnomalous ? 1.5 : 0.8}
        opacity={isSelected || isHighlighted || isAnomalous ? 0.7 : 0.3}
        strokeDasharray={isSelected ? '4 2' : 'none'}
      />

      {/* Main node body */}
      <circle
        cx={station.x}
        cy={station.y}
        r={radius}
        fill={isAnomalous ? `${borderColor}33` : `${config.color}22`}
        stroke={borderColor}
        strokeWidth={isSelected || isHighlighted || isAnomalous ? 2.5 : 1.5}
        style={{
          filter: `drop-shadow(0 0 ${isSelected || isAnomalous ? 12 : 6}px ${borderColor}88)`,
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
        x={station.x}
        y={station.y + 4}
        textAnchor="middle"
        fontSize={8}
        fill={config.color}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {station.shortName}
      </text>

      {/* Station full name label */}
      <text
        x={station.x}
        y={labelY}
        textAnchor="middle"
        fontSize={9.5}
        fill={isSelected || isHighlighted ? 'white' : '#94a3b8'}
        fontFamily="system-ui"
        style={{ fontWeight: isSelected || isHighlighted ? '600' : '400' }}
      >
        {station.name}
      </text>

      {/* Capacity bar */}
      <rect
        x={station.x - 18}
        y={labelY + 5}
        width={36}
        height={3}
        rx={1.5}
        fill="#1e3a5f"
      />
      <rect
        x={station.x - 18}
        y={labelY + 5}
        width={36 * loadPct}
        height={3}
        rx={1.5}
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
}: {
  edge: Edge;
  from: Station;
  to: Station;
  isActive: boolean;
  isHighlighted: boolean;
  isAnomalous: boolean;
}) {
  const loadPct = edge.maxCapacity > 0 ? edge.currentLoad / edge.maxCapacity : 0;
  const isCritical = loadPct >= 0.95;
  const baseOpacity = isActive || isHighlighted || isAnomalous ? 1 : 0.25;
  const strokeColor = isHighlighted
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
        strokeWidth={isHighlighted ? 2.5 : isAnomalous ? 2 : isActive ? 2 : 1}
        opacity={baseOpacity}
        strokeDasharray={isAnomalous ? '6 3' : isActive ? '8 4' : isHighlighted ? '6 3' : 'none'}
        className={isActive || isAnomalous ? 'route-dash' : ''}
        style={
          isActive || isHighlighted || isAnomalous
            ? { filter: `drop-shadow(0 0 ${isAnomalous ? 6 : 4}px ${strokeColor})` }
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

      {/* Cost label on hover-friendly path - only for highlighted/active */}
      {(isHighlighted || isActive) && (
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
}: GraphViewProps) {
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);

  const activeShipments = useMemo(
    () => shipments.filter(s => s.status === 'in-transit'),
    [shipments]
  );


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
            <stop offset="0%" stopColor="#0a1628" />
            <stop offset="100%" stopColor="#020817" />
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
        <GridLines />

        {/* Stars */}
        {STARS.map(s => (
          <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.op} />
        ))}

        {/* Region labels */}
        <text x={140} y={560} fontSize={9} fill="#1e3a5f" fontFamily="monospace" letterSpacing="3">
          INNER SYSTEM
        </text>
        <text x={580} y={570} fontSize={9} fill="#1e3a5f" fontFamily="monospace" letterSpacing="3">
          ASTEROID BELT
        </text>
        <text x={950} y={560} fontSize={9} fill="#1e3a5f" fontFamily="monospace" letterSpacing="3">
          OUTER SYSTEM
        </text>

        {/* Separator lines */}
        <line x1={560} y1={40} x2={560} y2={660} stroke="#1e3a5f" strokeWidth={0.5} strokeDasharray="4 6" opacity={0.5} />
        <line x1={840} y1={40} x2={840} y2={660} stroke="#1e3a5f" strokeWidth={0.5} strokeDasharray="4 6" opacity={0.5} />

        {/* Edges */}
        {edges.map(edge => {
          const from = stations.find(s => s.id === edge.from);
          const to = stations.find(s => s.id === edge.to);
          if (!from || !to) return null;

          return (
            <EdgeLine
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              isActive={isEdgeActive(edge, activeShipments)}
              isHighlighted={isEdgeInPath(edge, highlightedPath)}
              isAnomalous={anomalyEntityIds.has(edge.id)}
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
          <rect width={130} height={130} rx={6} fill="#020817" stroke="#1e3a5f" strokeWidth={1} opacity={0.9} />
          <text x={10} y={18} fontSize={8} fill="#334155" fontFamily="monospace" letterSpacing="1">STATION TYPES</text>
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
    </div>
  );
}
