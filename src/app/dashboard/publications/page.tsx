'use client';

import { useEffect, useState } from 'react';
import type { Publication } from '@/lib/types';

export default function PublicationsPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchPublications();
    const interval = setInterval(fetchPublications, 4000);
    return () => clearInterval(interval);
  }, [filter]);

  async function fetchPublications() {
    const params = filter !== 'all' ? `?status=${filter}` : '?limit=100';
    const res = await fetch(`/api/publications${params}`);
    setPublications(await res.json());
  }

  const statusCounts = {
    all: publications.length,
    success: publications.filter((p) => p.status === 'success').length,
    failed: publications.filter((p) => p.status === 'failed').length,
    pending: publications.filter((p) => p.status === 'pending').length,
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-2xl font-bold">Publicaciones</h2>
        <span className="text-xs text-gray-500">se actualiza sola cada 4s</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'success', 'failed', 'pending'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? 'Todas' : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1.5 opacity-60">({statusCounts[s]})</span>
          </button>
        ))}
      </div>

      {/* Publications list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {publications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay publicaciones {filter !== 'all' ? `con estado "${filter}"` : ''}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4">Contenido</th>
                <th className="text-left p-4">Método</th>
                <th className="text-left p-4">Estado</th>
                <th className="text-left p-4">Intentos</th>
                <th className="text-left p-4">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((pub) => (
                <tr key={pub.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-4 max-w-xs">
                    <p className="truncate text-gray-300">{pub.content}</p>
                    {pub.error && <p className="text-xs text-red-400 mt-1 truncate">{pub.error}</p>}
                  </td>
                  <td className="p-4">
                    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                      {pub.publishMethod || '—'}
                    </span>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={pub.status} />
                  </td>
                  <td className="p-4 text-gray-400">{pub.attempts}</td>
                  <td className="p-4 text-gray-500 text-xs">
                    {pub.publishedAt
                      ? new Date(pub.publishedAt).toLocaleString()
                      : pub.scheduledAt
                      ? `Programada: ${new Date(pub.scheduledAt).toLocaleString()}`
                      : new Date(pub.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
