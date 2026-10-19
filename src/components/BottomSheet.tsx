import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { SheetMode } from '../types';
import { Close } from './Icons';

interface Props {
  mode: SheetMode;
  onMode: (m: SheetMode) => void;
  /** posizione (px dall'alto del contenitore) dello stato "metà" */
  halfY: () => number;
  container: React.RefObject<HTMLElement | null>;
  eyebrow: string;
  title: string;
  children: ReactNode;
  scrollKey?: string;
}

export default function BottomSheet({ mode, onMode, halfY, container, eyebrow, title, children, scrollKey }: Props) {
  const sheet = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const y = useRef(0);
  const drag = useRef<{ y0: number; s0: number; t: number; last: number; v: number } | null>(null);

  const yFor = (m: SheetMode) => {
    const h = container.current?.clientHeight ?? 800;
    return m === 'full' ? h * 0.08 : m === 'half' ? halfY() : h + 30;
  };
  const place = (px: number, animate: boolean) => {
    const s = sheet.current; if (!s) return;
    y.current = px;
    s.classList.toggle('anim', animate);
    s.style.transform = `translateY(${px}px)`;
  };

  useLayoutEffect(() => { place(yFor(mode), true); }, [mode]);
  useEffect(() => { if (body.current) body.current.scrollTop = 0; }, [scrollKey]);
  useEffect(() => {
    const c = container.current; if (!c) return;
    const ro = new ResizeObserver(() => place(yFor(mode), false));
    ro.observe(c);
    return () => ro.disconnect();
  }, [mode]);

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.close')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, s0: y.current, t: performance.now(), last: e.clientY, v: 0 };
    sheet.current?.classList.remove('anim');
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const now = performance.now();
    d.v = (e.clientY - d.last) / Math.max(1, now - d.t); d.t = now; d.last = e.clientY;
    place(Math.max(yFor('full'), d.s0 + e.clientY - d.y0), false);
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const moved = Math.abs(e.clientY - d.y0);
    if (moved < 6) { onMode(mode === 'full' ? 'half' : 'full'); return; }
    let m: SheetMode;
    if (d.v > 0.6) m = mode === 'full' && y.current < yFor('half') ? 'half' : 'closed';
    else if (d.v < -0.6) m = 'full';
    else {
      const opts: [SheetMode, number][] = [['full', yFor('full')], ['half', yFor('half')], ['closed', yFor('closed')]];
      m = opts.reduce((a, b) => (Math.abs(b[1] - y.current) < Math.abs(a[1] - y.current) ? b : a))[0];
    }
    if (m === mode) place(yFor(m), true); else onMode(m);
  };

  return (
    <>
      <div className={'scrim' + (mode === 'full' ? ' on' : '')} onClick={() => onMode('half')} />
      <section className="sheet" ref={sheet} aria-label="Dettagli" aria-hidden={mode === 'closed'}>
        <div className="grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="handle" />
          <div className="sheet-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">{eyebrow}</div>
              <h2>{title}</h2>
            </div>
            <button className="close" onClick={() => onMode('closed')} aria-label="Chiudi"><Close /></button>
          </div>
        </div>
        <div className="sheet-body" ref={body} style={{ overflowY: mode === 'full' ? 'auto' : 'hidden' }}>{children}</div>
      </section>
    </>
  );
}
