'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { FacebookAccount } from '@/lib/types';

const SELECTED_ACCOUNT_KEY = 'fb-publisher:selected-account';

interface AccountContextValue {
  accounts: FacebookAccount[];
  accountId: string;
  setAccountId: (id: string) => void;
  refreshAccounts: () => Promise<void>;
  loading: boolean;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function pickFallback(accounts: FacebookAccount[], previousId: string): string {
  if (accounts.some((a) => a.id === previousId)) return previousId;
  const defaultAccount = accounts.find((a) => a.id === 'default');
  return defaultAccount ? defaultAccount.id : (accounts[0]?.id ?? 'default');
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [accountId, setAccountIdState] = useState('default');
  const [loading, setLoading] = useState(true);

  const refreshAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts');
    const data: FacebookAccount[] = await res.json();
    setAccounts(data);
    setAccountIdState((current) => pickFallback(data, current));
    return;
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    if (saved) setAccountIdState(saved);
    refreshAccounts().finally(() => setLoading(false));
  }, [refreshAccounts]);

  function setAccountId(id: string) {
    setAccountIdState(id);
    localStorage.setItem(SELECTED_ACCOUNT_KEY, id);
  }

  return (
    <AccountContext.Provider value={{ accounts, accountId, setAccountId, refreshAccounts, loading }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
