import type { Channel, Server, ToClient, ToServer } from '@manifold/net';

/**
 * A MATCH BETWEEN TABS (stage 1e): the tabs of this browser, on this site, talk through a
 * `BroadcastChannel`. One opens its match (`net open`), and another joins it (`net join`). Nothing
 * leaves the browser: it is for trying the network without a server of our own (where that will
 * live is still open, see the roadmap). What travels is exactly what a socket would carry later.
 *
 * Every message goes to every tab of the site, so each one says who it is for: a guest (the tab that
 * joins) and a host (the tab whose match it is). A guest knocks; every open host answers; the guest
 * chooses the first answer, and only that host connects it.
 */
type Envelope =
  | { kind: 'knock'; guest: string }
  | { kind: 'answer'; guest: string; host: string }
  | { kind: 'chosen'; guest: string; host: string }
  | { kind: 'toServer'; guest: string; host: string; message: ToServer }
  | { kind: 'toClient'; guest: string; host: string; message: ToClient }
  /** The guest left. */
  | { kind: 'bye'; guest: string; host: string }
  /** The host closed its match. */
  | { kind: 'closed'; host: string };

const channelName = (game: string) => `manifold.${game}.match`;
const newId = () => Math.random().toString(36).slice(2, 10);

/** Lets the tabs that knock join this server's match; `close` ends it for them. */
export function openToTabs(game: string, server: Server): { close(): void } {
  const host = newId();
  const bc = new BroadcastChannel(channelName(game));
  const guests = new Map<string, Channel<ToClient, ToServer>>();
  bc.onmessage = (e: MessageEvent<Envelope>) => {
    const m = e.data;
    if (m.kind === 'knock') bc.postMessage({ kind: 'answer', guest: m.guest, host } satisfies Envelope);
    else if (m.kind === 'chosen' && m.host === host && !guests.has(m.guest)) {
      const guest = m.guest;
      const channel: Channel<ToClient, ToServer> = {
        onMessage: null,
        onClose: null,
        send: (message) => bc.postMessage({ kind: 'toClient', guest, host, message } satisfies Envelope),
        close: () => {
          guests.delete(guest);
          bc.postMessage({ kind: 'closed', host } satisfies Envelope);
        },
      };
      guests.set(guest, channel);
      server.connect(channel);
    } else if (m.kind === 'toServer' && m.host === host) guests.get(m.guest)?.onMessage?.(m.message);
    else if (m.kind === 'bye' && m.host === host) {
      const channel = guests.get(m.guest);
      guests.delete(m.guest);
      channel?.onClose?.();
    }
  };
  return {
    close() {
      bc.postMessage({ kind: 'closed', host } satisfies Envelope);
      for (const channel of [...guests.values()]) channel.onClose?.();
      guests.clear();
      bc.close();
    },
  };
}

/** Joins a match opened in another tab: its channel, or null if no tab answers in `wait` milliseconds. */
export function joinFromTabs(game: string, wait = 1500): Promise<Channel<ToServer, ToClient> | null> {
  const guest = newId();
  const bc = new BroadcastChannel(channelName(game));
  return new Promise((resolve) => {
    let host: string | null = null;
    let open = true;
    const channel: Channel<ToServer, ToClient> = {
      onMessage: null,
      onClose: null,
      send: (message) => {
        if (open && host) bc.postMessage({ kind: 'toServer', guest, host, message } satisfies Envelope);
      },
      close: () => {
        if (!open) return;
        open = false;
        if (host) bc.postMessage({ kind: 'bye', guest, host } satisfies Envelope);
        bc.close();
      },
    };
    const timer = setTimeout(() => {
      if (host) return;
      bc.close();
      resolve(null);
    }, wait);
    bc.onmessage = (e: MessageEvent<Envelope>) => {
      const m = e.data;
      if (m.kind === 'answer' && m.guest === guest && !host) {
        host = m.host;
        clearTimeout(timer);
        bc.postMessage({ kind: 'chosen', guest, host } satisfies Envelope);
        resolve(channel);
      } else if (m.kind === 'toClient' && m.guest === guest && m.host === host) channel.onMessage?.(m.message);
      else if (m.kind === 'closed' && m.host === host && open) {
        open = false;
        bc.close();
        channel.onClose?.();
      }
    };
    bc.postMessage({ kind: 'knock', guest } satisfies Envelope);
  });
}
