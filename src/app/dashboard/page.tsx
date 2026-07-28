'use client';

import { useEffect, useState } from 'react';
import { useAccount } from './account-context';

interface Stats {
  totalGroups: number;
  activeGroups: number;
  totalTemplates: number;
  totalPublications: number;
  successRate: number;
  todayPublications: number;
  recentPublications: any[];
}

export default function DashboardPage() {
  const { accountId, accounts } = useAccount();
  const [stats, setStats] = useState<Stats | null>(null);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    setStats(null);
    async function fetchStats() {
      const [groups, templates, publications] = await Promise.all([
        fetch(`/api/groups?accountId=${accountId}`).then((r) => r.json()),
        fetch(`/api/templates?accountId=${accountId}`).then((r) => r.json()),
        fetch(`/api/publications?limit=10&accountId=${accountId}`).then((r) => r.json()),
      ]);

      const successful = publications.filter((p: any) => p.status === 'success').length;
      const total = publications.length;

      setStats({
        totalGroups: groups.length,
        activeGroups: groups.filter((g: any) => g.isActive).length,
        totalTemplates: templates.length,
        totalPublications: total,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
        todayPublications: publications.filter(
          (p: any) =>
            p.publishedAt && new Date(p.publishedAt).toDateString() === new Date().toDateString()
        ).length,
        recentPublications: publications.slice(0, 5),
      });
    }
    fetchStats();
  }, [accountId]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard{selectedAccount ? ` — ${selectedAccount.name}` : ''}</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Grupos activos" value={`${stats.activeGroups}/${stats.totalGroups}`} color="blue" />
        <StatCard title="Plantillas" value={stats.totalTemplates} color="purple" />
        <StatCard title="Publicaciones hoy" value={stats.todayPublications} color="green" />
        <StatCard title="Tasa de éxito" value={`${stats.successRate}%`} color="amber" />
      </div>

      {/* Recent publications */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4">Publicaciones recientes</h3>
        {stats.recentPublications.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay publicaciones aún. Configura grupos y plantillas para empezar.</p>
        ) : (
          <div className="space-y-3">
            {stats.recentPublications.map((pub: any) => (
              <div key={pub.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{pub.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {pub.publishMethod} · {pub.publishedAt ? new Date(pub.publishedAt).toLocaleString() : 'Pendiente'}
                  </p>
                </div>
                <StatusBadge status={pub.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  };

  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs uppercase tracking-wider opacity-70 mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    publishing: 'bg-blue-500/20 text-blue-400',
    retry: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-700 text-gray-400'}`}>
      {status}
    </span>
  );
}
