import { signInAnonymously } from 'firebase/auth';
import { collection, doc, getCountFromServer, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { getFirebase } from '@/lib/firebase';

import type { ForestTree } from './model';

/**
 * Public forests live at `forests/{uid}` (owner-writable, world-readable) and waterings at
 * `forests/{uid}/waterings/{visitorUid}_{YYYY-MM-DD}`. The security rules in `firestore.rules`
 * only allow creating a watering doc whose id matches the visitor and today's UTC date,
 * so each visitor can water each forest once per day.
 */
export interface PublicForest {
  nickname: string;
  trees: ForestTree[];
  updatedAt?: unknown;
}

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function publishForest(uid: string, forest: PublicForest) {
  const fb = getFirebase();
  if (!fb) throw new Error('firebase-not-configured');
  await setDoc(doc(fb.db, 'forests', uid), { ...forest, updatedAt: serverTimestamp() });
}

export async function fetchForest(forestId: string): Promise<PublicForest | null> {
  const fb = getFirebase();
  if (!fb) return null;
  const snap = await getDoc(doc(fb.db, 'forests', forestId));
  return snap.exists() ? (snap.data() as PublicForest) : null;
}

export async function countWaterings(forestId: string): Promise<number> {
  const fb = getFirebase();
  if (!fb) return 0;
  const snap = await getCountFromServer(collection(fb.db, 'forests', forestId, 'waterings'));
  return snap.data().count;
}

export type WaterResult = 'ok' | 'already' | 'failed';

export async function waterForest(forestId: string): Promise<WaterResult> {
  const fb = getFirebase();
  if (!fb) return 'failed';
  try {
    const user = fb.auth.currentUser ?? (await signInAnonymously(fb.auth)).user;
    const day = utcDay();
    const ref = doc(fb.db, 'forests', forestId, 'waterings', `${user.uid}_${day}`);
    if ((await getDoc(ref)).exists()) return 'already';
    await setDoc(ref, { visitor: user.uid, day, at: serverTimestamp() });
    return 'ok';
  } catch (err) {
    console.warn('[forest] watering failed', err);
    return 'failed';
  }
}
