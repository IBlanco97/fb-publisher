'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountProvider, useAccount } from './account-context';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/accounts', label: 'Cuentas', icon: '🔑' },
  { href: '/dashboard/groups', label: 'Grupos', icon: '👥' },
  { href: '/dashboard/templates', label: 'Plantillas', icon: '📝' },
  { href: '/dashboard/publications', label: 'Publicaciones', icon: '📤' },
  { href: '/dashboard/settings', label: 'Configuración', icon: '⚙️' },
];

function AccountSelector() {
  const { accounts, accountId, setAccountId, loading } = useAccount();

  if (loading) {
    return <div className="text-xs text-gray-500">Cargando cuentas…</div>;
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Cuenta activa</label>
      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.isActive ? '●' : '○'} {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AccountProvider>
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">FB Publisher</h1>
          <p className="text-xs text-gray-400 mt-1">Publicador de anuncios</p>
        </div>

        <div className="p-4 border-b border-gray-800">
          <AccountSelector />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-500">
            Método: <span className="text-gray-400">Playwright (m.facebook.com)</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
    </AccountProvider>
  );
}
