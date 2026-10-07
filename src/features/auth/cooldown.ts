import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { normalizeEmail } from './validation';

export type MailKind = 'reset' | 'confirm';

/** Resend lock per mail kind + address, kept while the app runs so leaving and reopening a screen keeps the timer. */
const useCooldowns = create<{ until: Record<string, number> }>()(() => ({ until: {} }));

const keyOf = (kind: MailKind, email: string) => `${kind}:${normalizeEmail(email)}`;

export function startMailCooldown(kind: MailKind, email: string, seconds: number) {
  const key = keyOf(kind, email);
  useCooldowns.setState((s) => ({ until: { ...s.until, [key]: Date.now() + seconds * 1000 } }));
}

/** Seconds left before this kind of mail may be sent to `email` again (0 = ready). */
export function useMailCooldown(kind: MailKind, email: string) {
  const until = useCooldowns((s) => s.until[keyOf(kind, email)] ?? 0);
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    if (until <= Date.now()) return () => clearTimeout(first);
    const timer = setInterval(() => {
      tick();
      if (Date.now() >= until) clearInterval(timer);
    }, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until]);
  return left;
}
