import React from 'react';
import type { Anomaly, NotificationEntry } from '../types';

interface AlertsPanelProps {
  activeAnomalies: Anomaly[];
  notifications: NotificationEntry[];
  onClearNotifications: () => void;
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const isCrit = anomaly.type === 'critical';
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-1.5 ${
        isCrit
          ? 'border-red-500/50 bg-red-950/30'
          : 'border-orange-500/40 bg-orange-950/20'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isCrit ? 'bg-red-500 animate-pulse' : 'bg-orange-400 animate-pulse'
            }`}
          />
          <span
            className={`text-[10px] font-mono font-bold tracking-wider ${
              isCrit ? 'text-red-400' : 'text-orange-400'
            }`}
          >
            {isCrit ? 'CRITICAL' : 'WARNING'}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {anomaly.category === 'depot-capacity' ? 'DEPOT' : 'ROUTE'}
          </span>
        </div>
        <span
          className={`text-xs font-mono font-bold ${
            isCrit ? 'text-red-300' : 'text-orange-300'
          }`}
        >
          {(anomaly.pct * 100).toFixed(0)}%
        </span>
      </div>

      <p className={`text-xs ${isCrit ? 'text-red-300/80' : 'text-orange-300/80'}`}>
        {anomaly.message}
      </p>

      {/* Load bar */}
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(anomaly.pct * 100, 100)}%`,
            backgroundColor: isCrit ? '#ef4444' : '#f97316',
            boxShadow: `0 0 6px ${isCrit ? '#ef444488' : '#f9731688'}`,
          }}
        />
      </div>
    </div>
  );
}

function NotificationRow({ entry }: { entry: NotificationEntry }) {
  const isResolved = entry.type === 'resolved';
  const isCrit = entry.type === 'critical';

  const dotColor = isResolved
    ? 'bg-green-500'
    : isCrit
    ? 'bg-red-500'
    : 'bg-orange-400';

  const textColor = isResolved
    ? 'text-green-400/70'
    : isCrit
    ? 'text-red-400/80'
    : 'text-orange-400/80';

  const time = new Date(entry.timestamp);
  const timeStr = time.toTimeString().slice(0, 8);

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-800/40 last:border-0">
      <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] leading-snug ${textColor}`}>{entry.message}</p>
      </div>
      <span className="text-[10px] font-mono text-slate-700 flex-shrink-0">{timeStr}</span>
    </div>
  );
}

export default function AlertsPanel({
  activeAnomalies,
  notifications,
  onClearNotifications,
}: AlertsPanelProps) {
  const critCount = activeAnomalies.filter(a => a.type === 'critical').length;
  const warnCount = activeAnomalies.filter(a => a.type === 'warning').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Active anomalies */}
      <div className="p-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Active Anomalies
          </span>
          {activeAnomalies.length > 0 && (
            <div className="flex items-center gap-2">
              {critCount > 0 && (
                <span className="text-[10px] font-mono font-bold text-red-400 animate-pulse">
                  {critCount} CRITICAL
                </span>
              )}
              {warnCount > 0 && (
                <span className="text-[10px] font-mono text-orange-400">
                  {warnCount} WARN
                </span>
              )}
            </div>
          )}
        </div>

        {activeAnomalies.length === 0 ? (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-green-950/20 border border-green-500/20">
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-green-400 font-mono">All systems nominal</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto scrollbar-thin-panel">
            {activeAnomalies
              .sort((a, b) => (b.type === 'critical' ? 1 : 0) - (a.type === 'critical' ? 1 : 0))
              .map(a => (
                <AnomalyCard key={a.id} anomaly={a} />
              ))}
          </div>
        )}
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-slate-800/60 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Event Log
          </span>
          {notifications.length > 0 && (
            <button
              onClick={onClearNotifications}
              className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-700">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-mono">No events yet</span>
          </div>
        ) : (
          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 overflow-y-auto scrollbar-panel px-3 py-2">
              {notifications.map(n => (
                <NotificationRow key={n.id} entry={n} />
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
}
