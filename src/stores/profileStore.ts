import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_AVATAR, type AvatarId } from '@/features/profile/avatars';
import { persistStorage } from '@/lib/storage';

export type AuthMode = 'guest' | 'anonymous' | 'kakao' | 'google' | 'email';

export const FOREST_NAME_MAX = 16;

interface ProfileState {
  nickname: string;
  /** Custom title of the home forest card; empty = the default '나만의 독서 숲'. */
  forestName: string;
  avatar: AvatarId;
  authMode: AuthMode;
  uid: string | null;
  email: string | null;
  photoURL: string | null;
  /** Real (non-anonymous) account whose records are on this device; null = guest / anonymous data that carries over on sign-in. */
  dataOwner: string | null;
  setNickname: (nickname: string) => void;
  setForestName: (forestName: string) => void;
  setAvatar: (avatar: AvatarId) => void;
  setAccount: (account: { authMode: AuthMode; uid: string | null; email?: string | null; photoURL?: string | null }) => void;
  setDataOwner: (uid: string | null) => void;
  /** Another account signed in on this device: forget the previous account's profile look (its copy lives on the server). */
  resetIdentity: () => void;
}

const DEFAULT_NICKNAMES = ['도토리', '새싹', '솔방울', '솜사탕', '나뭇잎', '조약돌'];
const DEFAULT_SUFFIX = '독서가';

function randomDefaultNickname() {
  return `${DEFAULT_NICKNAMES[Math.floor(Math.random() * DEFAULT_NICKNAMES.length)]} ${DEFAULT_SUFFIX}`;
}

export function isDefaultNickname(nickname: string) {
  return nickname.endsWith(DEFAULT_SUFFIX);
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      nickname: randomDefaultNickname(),
      authMode: 'guest',
      uid: null,
      email: null,
      photoURL: null,
      dataOwner: null,
      forestName: '',
      avatar: DEFAULT_AVATAR,
      setNickname: (nickname) => set({ nickname: nickname.trim() || `숲 ${DEFAULT_SUFFIX}` }),
      setForestName: (forestName) => set({ forestName: forestName.trim().slice(0, FOREST_NAME_MAX) }),
      setAvatar: (avatar) => set({ avatar }),
      setAccount: ({ authMode, uid, email = null, photoURL = null }) => set({ authMode, uid, email, photoURL }),
      setDataOwner: (dataOwner) => set({ dataOwner }),
      resetIdentity: () => set({ nickname: randomDefaultNickname(), forestName: '', avatar: DEFAULT_AVATAR }),
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
