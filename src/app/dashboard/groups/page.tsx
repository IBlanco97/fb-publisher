'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FacebookGroup, GroupTag } from '@/lib/types';
import { useAccount } from '../account-context';

const MEMBERSHIP_LABELS: Record<string, { label: string; className: string }> = {
  member: { label: 'Miembro', className: 'bg-green-500/20 text-green-400' },
  not_member: { label: 'No miembro', className: 'bg-red-500/20 text-red-400' },
  pending: { label: 'Solicitud pendiente', className: 'bg-yellow-500/20 text-yellow-400' },
  error: { label: 'Error al verificar', className: 'bg-gray-700 text-gray-400' },
  unknown: { label: 'Sin verificar', className: 'bg-gray-700 text-gray-400' },
};

const TAG_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

const EMPTY_FORM = {
  name: '',
  fbGroupId: '',
  url: '',
  category: '',
  maxPostsPerDay: 3,
  cooldownMinutes: 60,
};

export default function GroupsPage() {
  const { accountId } = useAccount();
  const [groups, setGroups] = useState<FacebookGroup[]>([]);
  const [tags, setTags] = useState<GroupTag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // List controls
  const [search, setSearch] = useState('');
  const [filterTagId, setFilterTagId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [busy, setBusy] = useState(false);

  // Import panel
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importActivate, setImportActivate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ createdCount: number; skippedCount: number; skipped: { line: number; reason: string }[] } | null>(null);

  const refresh = useCallback(async () => {
    const [groupsRes, tagsRes] = await Promise.all([
      fetch(`/api/groups?accountId=${accountId}`),
      fetch(`/api/tags?accountId=${accountId}`),
    ]);
    setGroups(await groupsRes.json());
    setTags(await tagsRes.json());
  }, [accountId]);

  // Declared after `refresh` on purpose: a useCallback const is not hoisted.
  useEffect(() => {
    resetForm();
    setSelected(new Set());
    setFilterTagId('');
    refresh();
  }, [accountId, refresh]);

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (filterTagId && !g.tagIds.includes(filterTagId)) return false;
      if (!needle) return true;
      return (
        g.name.toLowerCase().includes(needle) ||
        g.fbGroupId.toLowerCase().includes(needle) ||
        (g.category ?? '').toLowerCase().includes(needle)
      );
    });
  }, [groups, search, filterTagId]);

  const allVisibleSelected = visible.length > 0 && visible.every((g) => selected.has(g.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((g) => next.delete(g.id));
      else visible.forEach((g) => next.add(g.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyTagToSelection(tagId: string, action: 'add' | 'remove') {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await fetch(`/api/tags/${tagId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: [...selected], action }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createTagFromSelection() {
    const name = newTagName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: TAG_COLORS[tags.length % TAG_COLORS.length], accountId }),
      });
      const tag: GroupTag = await res.json();
      if (selected.size > 0) {
        await fetch(`/api/tags/${tag.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupIds: [...selected], action: 'add' }),
        });
      }
      setNewTagName('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteTag(tag: GroupTag) {
    if (!confirm(`¿Eliminar el tag "${tag.name}"? Los grupos no se borran.`)) return;
    await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
    if (filterTagId === tag.id) setFilterTagId('');
    await refresh();
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
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este grupo?')) return;
    await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    refresh();
  }

  async function toggleActive(group: FacebookGroup) {
    await fetch(`/api/groups/${group.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !group.isActive }),
    });
    refresh();
  }

  async function checkMembership(group: FacebookGroup) {
    setCheckingId(group.id);
    try {
      await fetch(`/api/groups/${group.id}/check-membership`, { method: 'POST' });
      await refresh();
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
    setForm(EMPTY_FORM);
  }

  function extractGroupId(url: string) {
    setForm((f) => ({ ...f, url, fbGroupId: parseGroupId(url) ?? f.fbGroupId }));
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
      await refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold">Grupos de Facebook</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {groups.length} grupos · {groups.filter((g) => g.isActive).length} activos · {tags.length} tags
          </p>
        </div>
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

      {/* Tag bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterTagId('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterTagId === ''
                ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            Todos ({groups.length})
          </button>
          {tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center">
              <button
                onClick={() => setFilterTagId(filterTagId === tag.id ? '' : tag.id)}
                className={`pl-2 pr-2 py-1 rounded-l-full text-xs font-medium border transition-colors ${
                  filterTagId === tag.id ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                }`}
                style={filterTagId === tag.id ? { borderColor: tag.color } : undefined}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: tag.color }} />
                {tag.name} ({tag.groupCount ?? 0})
              </button>
              <button
                onClick={() => deleteTag(tag)}
                title={`Eliminar tag ${tag.name}`}
                className="px-1.5 py-1 rounded-r-full text-xs border border-l-0 border-gray-700 bg-gray-800 text-gray-600 hover:text-red-400 hover:border-gray-600 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* List controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, ID o categoría…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="flex items-center gap-3 text-sm text-gray-400 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              disabled={visible.length === 0}
              className="w-4 h-4 accent-blue-500"
            />
            Marcar todos
          </label>
          <span className="text-gray-600">
            {visible.length} de {groups.length}
            {selected.size > 0 && ` · ${selected.size} seleccionados`}
          </span>
        </div>
      </div>

      {/* Bulk actions — only meaningful with a selection */}
      {selected.size > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-blue-300 font-medium mr-1">{selected.size} seleccionados:</span>
          <select
            defaultValue=""
            disabled={busy || tags.length === 0}
            onChange={(e) => {
              if (e.target.value) applyTagToSelection(e.target.value, 'add');
              e.target.value = '';
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Asignar tag…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            defaultValue=""
            disabled={busy || tags.length === 0}
            onChange={(e) => {
              if (e.target.value) applyTagToSelection(e.target.value, 'remove');
              e.target.value = '';
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="">Quitar tag…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createTagFromSelection();
                }
              }}
              placeholder="Nuevo tag…"
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs w-32 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={createTagFromSelection}
              disabled={busy || !newTagName.trim()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
            >
              Crear y asignar
            </button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Limpiar selección
          </button>
        </div>
      )}

      {/* Groups list — own scroll so the page header and controls stay put */}
      {visible.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
          {groups.length === 0
            ? 'No hay grupos configurados. Agrega tu primer grupo de Facebook.'
            : 'Ningún grupo coincide con el filtro.'}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="max-h-[calc(100vh-22rem)] min-h-[20rem] overflow-y-auto divide-y divide-gray-800">
            {visible.map((group) => (
              <div
                key={group.id}
                className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                  selected.has(group.id) ? 'bg-blue-500/5' : 'hover:bg-gray-800/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(group.id)}
                  onChange={() => toggleOne(group.id)}
                  className="w-4 h-4 accent-blue-500 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${group.isActive ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <span className="font-medium truncate">{group.name}</span>
                    {group.tagIds.map((tid) => {
                      const tag = tagsById.get(tid);
                      if (!tag) return null;
                      return (
                        <span
                          key={tid}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${tag.color}22`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      );
                    })}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        MEMBERSHIP_LABELS[group.membershipStatus ?? 'unknown'].className
                      }`}
                    >
                      {MEMBERSHIP_LABELS[group.membershipStatus ?? 'unknown'].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    ID: {group.fbGroupId} · máx {group.maxPostsPerDay}/día · cooldown {group.cooldownMinutes}min
                    {group.lastPublishedAt && ` · última: ${new Date(group.lastPublishedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => checkMembership(group)}
                    disabled={checkingId === group.id}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-xs transition-colors"
                  >
                    {checkingId === group.id ? 'Verificando…' : 'Verificar'}
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Facebook group URLs come in two shapes: a numeric id and a vanity slug.
 * The production lists contain both, plus business.facebook.com hosts, so a
 * digits-only pattern would silently drop a chunk of them.
 */
function parseGroupId(url: string): string | null {
  const match = url.match(/(?:facebook\.com)\/groups\/([^/?#]+)/i);
  return match ? match[1] : null;
}
