'use client';

import { useEffect, useState } from 'react';
import type { ScheduleRule } from '@/lib/types';

export default function SettingsPage() {
  const [schedules, setSchedules] = useState<ScheduleRule[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    groupIds: [] as string[],
    templateIds: [] as string[],
    cronExpression: '0 9,14,19 * * *',
    timezone: 'America/Bogota',
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    const [s, g, t] = await Promise.all([
      fetch('/api/scheduler').then((r) => r.json()),
      fetch('/api/groups').then((r) => r.json()),
      fetch('/api/templates').then((r) => r.json()),
    ]);
    setSchedules(s);
    setGroups(g);
    setTemplates(t);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ name: '', groupIds: [], templateIds: [], cronExpression: '0 9,14,19 * * *', timezone: 'America/Bogota' });
    fetchAll();
  }

  async function toggleSchedule(rule: ScheduleRule) {
    await fetch(`/api/scheduler/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    fetchAll();
  }

  async function deleteSchedule(id: string) {
    if (!confirm('¿Eliminar esta regla de programación?')) return;
    await fetch(`/api/scheduler/${id}`, { method: 'DELETE' });
    fetchAll();
  }

  function toggleSelection(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  const cronPresets = [
    { label: '3x al día (9, 14, 19h)', value: '0 9,14,19 * * *' },
    { label: '2x al día (10, 18h)', value: '0 10,18 * * *' },
    { label: 'Cada hora (9-21h)', value: '0 9-21 * * *' },
    { label: 'Lunes a viernes 9h', value: '0 9 * * 1-5' },
    { label: 'Personalizado', value: '' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Configuración y Programación</h2>
          <p className="text-sm text-gray-400 mt-1">Configura reglas automáticas de publicación</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nueva regla'}
        </button>
      </div>

      {/* Create schedule form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre de la regla</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Publicación diaria - Ventas"
              required
            />
          </div>

          {/* Group selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Grupos</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, groupIds: toggleSelection(f.groupIds, g.id) }))}
                  className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    form.groupIds.includes(g.id)
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
            {groups.length === 0 && <p className="text-xs text-gray-600">Crea grupos primero</p>}
          </div>

          {/* Template selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Plantillas</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, templateIds: toggleSelection(f.templateIds, t.id) }))}
                  className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    form.templateIds.includes(t.id)
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            {templates.length === 0 && <p className="text-xs text-gray-600">Crea plantillas primero</p>}
          </div>

          {/* Cron expression */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Frecuencia</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {cronPresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => p.value && setForm((f) => ({ ...f, cronExpression: p.value }))}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    form.cronExpression === p.value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              value={form.cronExpression}
              onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="0 9,14,19 * * *"
            />
            <p className="text-xs text-gray-600 mt-1">Formato cron: minuto hora día-mes mes día-semana</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Zona horaria</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="America/Bogota">America/Bogota (COT)</option>
              <option value="America/Mexico_City">America/Mexico_City (CST)</option>
              <option value="America/Lima">America/Lima (PET)</option>
              <option value="America/Buenos_Aires">America/Buenos_Aires (ART)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/Madrid">Europe/Madrid (CET)</option>
            </select>
          </div>

          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
            Crear regla de programación
          </button>
        </form>
      )}

      {/* Schedule rules list */}
      <div className="space-y-3">
        {schedules.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            No hay reglas de programación. Crea una para empezar a publicar automáticamente.
          </div>
        ) : (
          schedules.map((rule) => (
            <div key={rule.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <span className="font-medium">{rule.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-mono">{rule.cronExpression}</span> · {rule.timezone} ·
                    {rule.groupIds.length} grupos · {rule.templateIds.length} plantillas ·
                    rotación #{rule.rotationIndex}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleSchedule(rule)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      rule.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {rule.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => deleteSchedule(rule.id)} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
