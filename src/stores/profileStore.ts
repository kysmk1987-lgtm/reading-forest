import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

export type AuthMode = 'guest' | 'anonymous' | 'kakao' | 'google' | 'email';

interface ProfileState {
  nickname: string;
  authMode: AuthMode;
  uid: string | null;
  email: string | null;
  photoURL: string | null;
  setNickname: (nickname: string) => void;
  setAccount: (account: { authMode: AuthMode; uid: string | null; email?: string | null; photoURL?: string | null }) => void;
}

const DEFAULT_NICKNAMES = ['도토리', '새싹', '솔방울', '솜사탕', '나뭇잎', '조약돌'];
const DEFAULT_SUFFIX = '독서가';

export function isDefaultNickname(nickname: string) {
  return nickname.endsWith(DEFAULT_SUFFIX);
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      nickname: `${DEFAULT_NICKNAMES[Math.floor(Math.random() * DEFAULT_NICKNAMES.length)]} ${DEFAULT_SUFFIX}`,
      authMode: 'guest',
      uid: null,
      email: null,
      photoURL: null,
      setNickname: (nickname) => set({ nickname: nickname.trim() || `숲 ${DEFAULT_SUFFIX}` }),
      setAccount: ({ authMode, uid, email = null, photoURL = null }) => set({ authMode, uid, email, photoURL }),
    }),
    {
      name: 'rf-profile',
      storage: persistStorage,
      version: 1,
      // Persist the generated default nickname on first launch so it stays stable across visits.
      onRehydrateStorage: () => (state) => state?.setNickname(state.nickname),
      migrate: (persisted, version) => {
        const state = persisted as ProfileState;
        // v0 generated nicknames used a different suffix and word list; regenerate those defaults.
        if (version < 1 && state?.nickname?.endsWith(' 주민')) {
          const base = state.nickname.split(' ')[0];
          state.nickname = `${DEFAULT_NICKNAMES.includes(base) ? base : '새싹'} ${DEFAULT_SUFFIX}`;
        }
        return state;
      },
    },
  ),
);
