/**
 * REPLAYS IN A LINK (stage 1c). A replay is text (see the core's replay.ts); in a link it goes
 * compressed (deflate, which the browser brings: `CompressionStream`) and written with the 64 letters
 * an address accepts as they are (base64url). Like a recipe, it goes in the fragment (`#`), which
 * never travels to a server.
 *
 *   …/jugar/dojo/course/#replay=…   plays it, and checks at the end that it gave the same
 *   …/jugar/dojo/course/#ghost=…    runs it as a ghost, next to the live player
 */
export const REPLAY_PREFIX = 'replay=';
export const GHOST_PREFIX = 'ghost=';

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The fragment for a replay's text: `replay=…` (or `ghost=…`, with that prefix). */
export async function replayToFragment(text: string, prefix = REPLAY_PREFIX): Promise<string> {
  return prefix + toBase64Url(await deflate(text));
}

/** The replay's text in a fragment with that prefix, or null if it does not carry one (or it is broken). */
export async function replayFromFragment(fragment: string, prefix = REPLAY_PREFIX): Promise<string | null> {
  const body = fragment.replace(/^#/, '');
  if (!body.startsWith(prefix)) return null;
  try {
    return await inflate(fromBase64Url(body.slice(prefix.length)));
  } catch {
    return null;
  }
}
