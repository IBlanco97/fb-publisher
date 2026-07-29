'use client';

import { useState } from 'react';
import type { FacebookAccount } from '@/lib/types';
import { useAccount } from '../account-context';

export default function AccountsPage() {
  const { accounts, refreshAccounts, loading } = useAccount();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [loginNoticeId, setLoginNoticeId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    proxyServer: '',
    proxyUsername: '',
    proxyPassword: '',
  });

  async function startLogin(account: FacebookAccount) {
    setLoggingInId(account.id);
    setLoginNoticeId(null);
    try {
      await fetch(`/api/accounts/${account.id}/login`, { method: 'POST' });
      setLoginNoticeId(account.id);
    } finally {
      setTimeout(() => setLoggingInId(null), 3000);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await fetch(`/api/accounts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } else {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    }
    resetForm();
    refreshAccounts();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta cuenta? Sus grupos, plantillas y reglas no se eliminan — quedan sin cuenta asociada.')) return;
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    refreshAccounts();
  }

  async function toggleActive(account: FacebookAccount) {
    await fetch(`/api/accounts/${account.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !account.isActive }),
    });
    refreshAccounts();
  }

  function startEdit(account: FacebookAccount) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      proxyServer: account.proxy?.server || '',
      proxyUsername: account.proxy?.username || '',
      proxyPassword: account.proxy?.password || '',
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', proxyServer: '', proxyUsername: '', proxyPassword: '' });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Cuentas de Facebook</h2>
          <p className="text-sm text-gray-400 mt-1">Cada cuenta tiene su propia sesión de navegador y su propio proxy, aisladas entre sí.</p>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Agregar cuenta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Cuenta Ventas Norte"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Proxy server</label>
              <input
                value={form.proxyServer}
                onChange={(e) => setForm((f) => ({ ...f, proxyServer: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="http://1.2.3.4:8080"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Usuario proxy</label>
              <input
                value={form.proxyUsername}
                onChange={(e) => setForm((f) => ({ ...f, proxyUsername: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="opcional"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Clave proxy</label>
              <input
                type="password"
                value={form.proxyPassword}
                onChange={(e) => setForm((f) => ({ ...f, proxyPassword: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="opcional"
              />
            </div>
          </div>
          <p className="text-xs text-gray-600">Dejar el proxy en blanco significa que esta cuenta sale a internet con la IP de esta máquina.</p>
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              {editingId ? 'Actualizar' : 'Crear cuenta'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">Cargando…</div>
        ) : accounts.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            No hay cuentas configuradas.
          </div>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <span className="font-medium">{account.name}</span>
                  {account.id === 'default' && (
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">cuenta principal</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {account.proxy
                    ? `Proxy: ${account.proxy.server}${account.proxy.username ? ` (${account.proxy.username} / ••••••)` : ''}`
                    : 'Sin proxy — usa la IP de esta máquina'}
                </p>
                {loginNoticeId === account.id && (
                  <p className="text-xs text-blue-400 mt-1">
                    Se abrió un navegador en esta máquina — iniciá sesión ahí y cerralo cuando termines.
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 ml-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startLogin(account)}
                    disabled={loggingInId === account.id}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 rounded text-xs transition-colors"
                  >
                    {loggingInId === account.id ? 'Abriendo…' : 'Iniciar sesión'}
                  </button>
                  <button
                    onClick={() => toggleActive(account)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      account.isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {account.isActive ? 'Activa' : 'Inactiva'}
                  </button>
                  <button onClick={() => startEdit(account)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(account.id)} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs transition-colors">
                    Eliminar
                  </button>
                </div>
                <p className="text-[11px] text-gray-600">Se abre en esta máquina, no en la tuya si mirás el dashboard desde otra PC.</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
