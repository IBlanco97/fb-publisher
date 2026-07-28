'use client';

import { useEffect, useState } from 'react';
import type { FacebookGroup } from '@/lib/types';
import { useAccount } from '../account-context';

const MEMBERSHIP_LABELS: Record<string, { label: string; className: string }> = {
  member: { label: 'Miembro', className: 'bg-green-500/20 text-green-400' },
  not_member: { label: 'No miembro', className: 'bg-red-500/20 text-red-400' },
  pending: { label: 'Solicitud pendiente', className: 'bg-yellow-500/20 text-yellow-400' },
  error: { label: 'Error al verificar', className: 'bg-gray-700 text-gray-400' },
  unknown: { label: 'Sin verificar', className: 'bg-gray-700 text-gray-400' },
};

export default function GroupsPage() {
  const { accountId } = useAccount();
  const [groups, setGroups] = useState<FacebookGroup[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    fbGroupId: '',
    url: '',
    category: '',
    maxPostsPerDay: 3,
    cooldownMinutes: 60,
  });

  useEffect(() => {
    resetForm();
    fetchGroups();
  }, [accountId]);

  async function fetchGroups() {
    const res = await fetch(`/api/groups?accountId=${accountId}`);
    setGroups(await res.json());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await fetch(`/api/groups/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } else {
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, accountId }),
      });
    }
    resetForm();
    fetchGroups();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este grupo?')) return;
    await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    fetchGroups();
  }

  async function toggleActive(group: FacebookGroup) {
    await fetch(`/api/groups/${group.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !group.isActive }),
    });
    fetchGroups();
  }

  async function checkMembership(group: FacebookGroup) {
    setCheckingId(group.id);
    try {
      await fetch(`/api/groups/${group.id}/check-membership`, { method: 'POST' });
      await fetchGroups();
    } finally {
      setCheckingId(null);
    }
  }

  function startEdit(group: FacebookGroup) {
    setEditingId(group.id);
    setForm({
      name: group.name,
      fbGroupId: group.fbGroupId,
      url: group.url,
      category: group.category || '',
      maxPostsPerDay: group.maxPostsPerDay,
      cooldownMinutes: group.cooldownMinutes,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({
      name: '',
      fbGroupId: '',
      url: '',
      category: '',
      maxPostsPerDay: 3,
      cooldownMinutes: 60,
    });
  }

  function extractGroupId(url: string) {
    const match = url.match(/groups\/(\d+)/);
    if (match) {
      setForm((f) => ({ ...f, fbGroupId: match[1], url }));
    } else {
      setForm((f) => ({ ...f, url }));
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Grupos de Facebook</h2>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Agregar grupo'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ventas Bogotá"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">URL del grupo</label>
              <input
                value={form.url}
                onChange={(e) => extractGroupId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="https://www.facebook.com/groups/123456789"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">ID del grupo (auto-detectado)</label>
              <input
                value={form.fbGroupId}
                onChange={(e) => setForm((f) => ({ ...f, fbGroupId: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="123456789"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Categoría</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ventas, Servicios..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Máx. publicaciones/día</label>
              <input
                type="number"
                value={form.maxPostsPerDay}
                onChange={(e) => setForm((f) => ({ ...f, maxPostsPerDay: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                min={1}
                max={20}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cooldown (minutos)</label>
              <input
                type="number"
                value={form.cooldownMinutes}
                onChange={(e) => setForm((f) => ({ ...f, cooldownMinutes: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                min={5}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              {editingId ? 'Actualizar' : 'Crear grupo'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Groups list */}
      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            No hay grupos configurados. Agrega tu primer grupo de Facebook.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full ${group.isActive ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span className="font-medium">{group.name}</span>
                  {group.category && (
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{group.category}</span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      MEMBERSHIP_LABELS[group.membershipStatus ?? 'unknown'].className
                    }`}
                  >
                    {MEMBERSHIP_LABELS[group.membershipStatus ?? 'unknown'].label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ID: {group.fbGroupId} · máx {group.maxPostsPerDay}/día · cooldown {group.cooldownMinutes}min
                </p>
                {group.lastPublishedAt && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Última publicación: {new Date(group.lastPublishedAt).toLocaleString()}
                  </p>
                )}
                {group.membershipCheckedAt && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    Membresía verificada: {new Date(group.membershipCheckedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => checkMembership(group)}
                  disabled={checkingId === group.id}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs transition-colors"
                >
                  {checkingId === group.id ? 'Verificando…' : 'Verificar membresía'}
                </button>
                <button
                  onClick={() => toggleActive(group)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    group.isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {group.isActive ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => startEdit(group)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
                  Editar
                </button>
                <button onClick={() => handleDelete(group.id)} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs transition-colors">
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
