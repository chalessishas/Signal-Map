"use client";

import { useEffect, useState, useCallback } from "react";

type Overview = {
  totalEvents: number;
  activeEvents: number;
  cancelledEvents: number;
  totalBuildings: number;
  matchedEventsCount: number;
  unmatchedEventsCount: number;
  matchRate: number;
};

type Source = {
  id: string;
  name: string;
  parserType: string;
  url: string;
  lastSuccessAt: string | null;
  lastError: string | null;
};

type IngestLog = {
  id: string;
  sourceId: string;
  sourceName: string;
  runAt: string;
  newCount: number;
  updatedCount: number;
  errorCount: number;
  rawError: string | null;
};

type CategoryItem = { category: string; count: number };
type BuildingItem = { buildingId: string; name: string; count: number };

type Stats = {
  overview: Overview;
  sources: Source[];
  recentLogs: IngestLog[];
  categoryBreakdown: CategoryItem[];
  topBuildings: BuildingItem[];
  generatedAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
      {sub && <div className="admin-stat-sub">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reingesting, setReingesting] = useState<string | null>(null);

  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token") ?? ""
    : "";

  const fetchStats = useCallback(async () => {
    if (!token) { setError("Missing ?token= parameter"); setLoading(false); return; }
    try {
      const res = await fetch(`/api/admin/stats?token=${token}`);
      if (!res.ok) { setError(res.status === 401 ? "Invalid token" : `Error ${res.status}`); return; }
      setStats(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function triggerReingest(sourceId: string) {
    setReingesting(sourceId);
    try {
      await fetch(`/api/admin/re-ingest/${sourceId}?token=${token}`);
      setTimeout(fetchStats, 2000);
    } finally {
      setReingesting(null);
    }
  }

  async function triggerFullIngest() {
    setReingesting("all");
    try {
      await fetch(`/api/cron/ingest?token=${token}`);
      setTimeout(fetchStats, 3000);
    } finally {
      setReingesting(null);
    }
  }

  if (loading) return <div className="admin-shell"><p className="admin-loading">Loading dashboard...</p></div>;
  if (error) return <div className="admin-shell"><p className="admin-error">{error}</p></div>;
  if (!stats) return null;

  const { overview: o } = stats;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>SignalMap Admin</h1>
        <div className="admin-header-actions">
          <span className="admin-timestamp">Updated {timeAgo(stats.generatedAt)}</span>
          <button className="admin-btn" onClick={fetchStats}>Refresh</button>
          <button
            className="admin-btn admin-btn-accent"
            onClick={triggerFullIngest}
            disabled={reingesting === "all"}
          >
            {reingesting === "all" ? "Ingesting..." : "Full Ingest"}
          </button>
        </div>
      </header>

      {/* Overview cards */}
      <section className="admin-cards">
        <StatCard label="Active Events" value={o.activeEvents} />
        <StatCard label="Total Events" value={o.totalEvents} sub={`${o.cancelledEvents} cancelled`} />
        <StatCard label="Buildings" value={o.totalBuildings} />
        <StatCard label="Match Rate" value={`${o.matchRate}%`} sub={`${o.unmatchedEventsCount} unmatched`} />
      </section>

      {/* Data Sources */}
      <section className="admin-section">
        <h2>Data Sources</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Parser</th>
                <th>Last Success</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stats.sources.map((s) => (
                <tr key={s.id}>
                  <td className="admin-source-name">{s.name}</td>
                  <td><code>{s.parserType}</code></td>
                  <td>{s.lastSuccessAt ? timeAgo(s.lastSuccessAt) : "Never"}</td>
                  <td>
                    {s.lastError
                      ? <span className="admin-badge admin-badge-error">Error</span>
                      : <span className="admin-badge admin-badge-ok">OK</span>
                    }
                  </td>
                  <td>
                    <button
                      className="admin-btn-sm"
                      onClick={() => triggerReingest(s.id)}
                      disabled={reingesting === s.id}
                    >
                      {reingesting === s.id ? "..." : "Re-ingest"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two-column: Top Buildings + Categories */}
      <div className="admin-two-col">
        <section className="admin-section">
          <h2>Top Buildings</h2>
          <div className="admin-list">
            {stats.topBuildings.map((b, i) => (
              <div key={b.buildingId} className="admin-list-item">
                <span className="admin-list-rank">{i + 1}</span>
                <span className="admin-list-name">{b.name}</span>
                <span className="admin-list-count">{b.count}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-section">
          <h2>Top Categories</h2>
          <div className="admin-list">
            {stats.categoryBreakdown.map((c, i) => (
              <div key={c.category} className="admin-list-item">
                <span className="admin-list-rank">{i + 1}</span>
                <span className="admin-list-name">{c.category}</span>
                <span className="admin-list-count">{c.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Ingest Logs */}
      <section className="admin-section">
        <h2>Recent Ingests</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>New</th>
                <th>Updated</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLogs.map((log) => (
                <tr key={log.id} className={log.errorCount > 0 ? "admin-row-error" : ""}>
                  <td>{timeAgo(log.runAt)}</td>
                  <td>{log.sourceName}</td>
                  <td className="admin-num-green">{log.newCount}</td>
                  <td className="admin-num">{log.updatedCount}</td>
                  <td className={log.errorCount > 0 ? "admin-num-red" : "admin-num"}>{log.errorCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
