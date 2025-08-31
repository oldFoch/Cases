import { broadcastBalanceFC } from '../config/money';

export async function refreshBalanceAndBroadcast() {
  let balance = null;

  try {
    const r = await fetch('/api/users/balance?_ts=' + Date.now(), { credentials: 'include' });
    if (r.ok) {
      const d = await r.json();
      if (typeof d.balance === 'number') balance = d.balance;
    }
  } catch {}

  if (balance === null) {
    try {
      const r = await fetch('/api/users/me?_ts=' + Date.now(), { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        if (typeof d.balance === 'number') balance = d.balance;
      }
    } catch {}
  }

  if (typeof balance === 'number') {
    // старое событие — чтобы ничего не сломать
    window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(balance) || 0 }));
    // новое событие — красивое FC-форматирование
    broadcastBalanceFC(balance);
  }
}

export function broadcastBalance(balance) {
  if (typeof balance === 'number') {
    window.dispatchEvent(new CustomEvent('balance:update', { detail: Number(balance) || 0 }));
    broadcastBalanceFC(balance);
  }
}
