import { useEffect, useMemo, useState } from 'react';

import { API_BASE_URL } from '@/config/app';
import { speciesOf } from '@/features/forest/species';
import { useEntitlements } from '@/lib/entitlements';
import { getSupabase } from '@/lib/supabase';
import { useLibraryStore } from '@/stores/libraryStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTimerStore } from '@/stores/timerStore';
import { useMyRegion, useTogetherStore } from '@/stores/togetherStore';

import {
  CHANNEL,
  demoPeers,
  peersFromPresenceState,
  setActiveChannel,
  usePresenceStore,
  type Peer,
  type PresencePayload,
} from './presence';
import { isRegionKey, regionFromIsoCode } from './regions';

/** Detects the 시·도 once per launch from `/api/geo` (IP based, no permission). */
function useRegionDetection() {
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/geo`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { region?: string | null } | null) => {
        if (cancelled || !data) return;
        const region = regionFromIsoCode(data.region);
        if (region) useTogetherStore.getState().setDetectedRegion(region);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
}

/** What this tab publishes (null = not reading right now → untrack). */
function useMyPayload(): PresencePayload | null {
  const region = useMyRegion();
  const running = useTimerStore((s) => s.status === 'running');
  const entryId = useTimerStore((s) => s.entryId);
  const roomId = useTogetherStore((s) => s.roomId);
  const nickname = useProfileStore((s) => s.nickname);
  const entry = useLibraryStore((s) => (entryId ? s.entries[entryId] : undefined));
  const { isPremium } = useEntitlements();
  return useMemo(() => {
    if (!running && !roomId) return null;
    const base: PresencePayload = { region, status: roomId ? 'room' : 'focusing' };
    if (!roomId) return base;
    return {
      ...base,
      room: roomId,
      nickname,
      species: entry ? speciesOf(entry, isPremium) : undefined,
      book: entry?.book.title,
      cover: entry?.book.coverUrl,
    };
  }, [running, roomId, region, nickname, entry, isPremium]);
}

/** Mount once at the root: keeps the Realtime channel (or demo simulation) and this tab's presence in sync. */
export function PresenceBridge() {
  useRegionDetection();
  const payload = useMyPayload();
  const payloadKey = JSON.stringify(payload);
  const [channelReady, setChannelReady] = useState(false);
  const sb = getSupabase();

  useEffect(() => {
    const store = usePresenceStore.getState();
    if (!sb) {
      store.setMode('demo');
      return;
    }
    const ch = sb.channel(CHANNEL, { config: { presence: { key: store.selfKey }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => {
      usePresenceStore.getState().setPeers(peersFromPresenceState(ch.presenceState(), store.selfKey));
    });
    ch.on('broadcast', { event: 'cheer' }, ({ payload: msg }) => {
      const { regionOverride, detectedRegion } = useTogetherStore.getState();
      const mine = regionOverride ?? detectedRegion;
      if (!msg || !isRegionKey(msg.to) || msg.to !== mine || typeof msg.emoji !== 'string') return;
      usePresenceStore.getState().pushCheer({ from: isRegionKey(msg.from) ? msg.from : null, emoji: msg.emoji.slice(0, 4) });
    });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        usePresenceStore.getState().setMode('live');
        setActiveChannel(ch);
        setChannelReady(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        usePresenceStore.getState().setMode('connecting');
      }
    });
    return () => {
      setActiveChannel(null);
      setChannelReady(false);
      sb.removeChannel(ch);
    };
  }, [sb]);

  // Live: publish / withdraw this tab's presence.
  useEffect(() => {
    if (!sb || !channelReady) return;
    const ch = sb.getChannels().find((c) => c.topic === `realtime:${CHANNEL}`);
    if (!ch) return;
    const current = JSON.parse(payloadKey) as PresencePayload | null;
    (current ? ch.track(current) : ch.untrack()).catch((err) => console.warn('[presence]', err));
  }, [sb, channelReady, payloadKey]);

  // Demo: simulated readers + this tab, refreshed every few seconds.
  useEffect(() => {
    if (sb) return;
    let tick = 0;
    const publish = () => {
      const { selfKey } = usePresenceStore.getState();
      const current = JSON.parse(payloadKey) as PresencePayload | null;
      const self: Peer[] = current ? [{ ...current, key: selfKey, self: true }] : [];
      usePresenceStore.getState().setPeers([...demoPeers(tick), ...self]);
      tick++;
    };
    publish();
    const timer = setInterval(publish, 6000);
    // Demo: a friendly simulated cheer shortly after you start reading.
    const cheer = JSON.parse(payloadKey)
      ? setTimeout(() => usePresenceStore.getState().pushCheer({ from: 'busan', emoji: '☕' }), 7000)
      : null;
    return () => {
      clearInterval(timer);
      if (cheer) clearTimeout(cheer);
    };
  }, [sb, payloadKey]);

  return null;
}
