import { copyData } from '@manifold/core';

/**
 * ONE END OF A CONNECTION: it sends one kind of message and receives the other. The server and the
 * client only know this; what carries the messages (the same page, another tab, a socket) is plugged
 * in from outside.
 */
export interface Channel<Out, In> {
  send(message: Out): void;
  /** Who receives what comes from the other end. */
  onMessage: ((message: In) => void) | null;
  /** Whom to tell when the other end leaves. */
  onClose: (() => void) | null;
  close(): void;
}

/**
 * Two ends joined IN THE SAME PROGRAM: what one sends, the other receives as a copy, as if it had
 * travelled (sharing an object between the server and a client would hide bugs that a real network
 * shows). Right away, or, with `later`, only when `flush()` says: to test with lag.
 */
export function localPair<A, B>(o: { later?: boolean } = {}): { a: Channel<A, B>; b: Channel<B, A>; flush(): number } {
  const queue: (() => void)[] = [];
  let closed = false;
  const end = <Out, In>(): Channel<Out, In> & { other: Channel<In, Out> | null } => ({
    other: null,
    onMessage: null,
    onClose: null,
    send(message: Out) {
      if (closed) return;
      const copy = copyData(message);
      const deliver = () => {
        if (!closed) this.other?.onMessage?.(copy);
      };
      if (o.later) queue.push(deliver);
      else deliver();
    },
    close() {
      if (closed) return;
      closed = true;
      this.other?.onClose?.();
    },
  });
  const a = end<A, B>();
  const b = end<B, A>();
  a.other = b;
  b.other = a;
  return {
    a,
    b,
    /** Delivers what was waiting (and what that sends meanwhile); says how many. */
    flush() {
      let n = 0;
      while (queue.length) {
        queue.shift()!();
        n++;
      }
      return n;
    },
  };
}
