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
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importActivate, setImportActivate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ createdCount: number; skippedCount: number; skipped: { line: number; reason: string }[] } | null>(null);
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

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!importText.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/groups/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText, accountId, isActive: importActivate }),
      });
      const result = await res.json();
      setImportResult(result);
      await fetchGroups();
    } finally {
      setImporting(false);
    }
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport((v) => !v)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            {showImport ? 'Cancelar' : 'Importar catálogo'}
          </button>
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Agregar grupo'}
          </button>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <form onSubmit={handleImportSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Pega un CSV/TSV o carga un archivo</label>
            <p className="text-xs text-gray-500 mb-2">
              Columnas: nombre, URL (facebook.com/groups/...), categoría (opcional). Con o sin fila de encabezado.
              Los grupos que ya existan en el catálogo se omiten automáticamente.
            </p>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleImportFile}
              className="block w-full text-sm text-gray-400 mb-2 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-800 file:text-gray-300 file:text-xs hover:file:bg-gray-700"
            />
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              placeholder={'nombre,url,categoria\nCubanos en Berlín,https://www.facebook.com/groups/cubanosenberlin/,Alemania'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={importActivate}
              onChange={(e) => setImportActivate(e.target.checked)}
              className="rounded border-gray-700 bg-gray-800"
            />
            Activar los grupos importados (por defecto quedan inactivos, solo catálogo)
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={importing || !importText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {importing ? 'Importando…' : 'Importar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowImport(false); setImportText(''); setImportResult(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Cerrar
            </button>
          </div>
          {importResult && (
            <div className="text-sm bg-gray-800 rounded-lg p-3 space-y-1">
              <p className="text-green-400">{importResult.createdCount} grupos importados.</p>
              {importResult.skippedCount > 0 && (
                <details>
                  <summary className="text-yellow-400 cursor-pointer">{importResult.skippedCount} omitidos (ver detalle)</summary>
                  <ul className="mt-1 text-xs text-gray-400 space-y-0.5 max-h-40 overflow-y-auto">
                    {importResult.skipped.map((s, i) => (
                      <li key={i}>{s.line >= 0 ? `Línea ${s.line}: ` : ''}{s.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </form>
      )}

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
