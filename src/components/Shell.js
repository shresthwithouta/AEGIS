'use client';

/**
 * The masthead and phase rail.
 *
 * Structure comes from the file jacket: an identifying masthead across the top
 * carrying the file number, then a single unbroken rail of the three disaster
 * phases with a marker on the one you are in. The rail never wraps — it scales
 * and scrolls — because losing your place in the phase sequence during an
 * incident is a real cost.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { StatusDot } from './ui';

const PHASES = [
  {
    id: 'before',
    label: 'Before',
    caption: 'Risk & preparedness',
    items: [
      { href: '/before', label: 'Vulnerability & forecast', icon: 'forecast' },
      { href: '/before/assistant', label: 'Doctrine assistant', icon: 'search' },
    ],
  },
  {
    id: 'during',
    label: 'During',
    caption: 'Response coordination',
    items: [
      { href: '/operations', label: 'Response pipeline', icon: 'node' },
      { href: '/drones', label: 'Drone console', icon: 'drone' },
    ],
  },
  {
    id: 'after',
    label: 'After',
    caption: 'Recovery & review',
    items: [
      { href: '/after', label: 'Damage & rebuild', icon: 'bridge' },
      { href: '/register', label: 'Audit register', icon: 'file' },
    ],
  },
];

function phaseOf(pathname) {
  if (pathname.startsWith('/before')) return 'before';
  if (pathname.startsWith('/operations') || pathname.startsWith('/drones')) return 'during';
  if (pathname.startsWith('/after') || pathname.startsWith('/register')) return 'after';
  return null;
}

function ThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem('aegis-theme');
      } catch {
        return null;
      }
    })();
    const initial = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('aegis-theme', next);
    } catch {
      /* private browsing — the choice just does not persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn !px-2 !py-1.5"
      title={theme === 'dark' ? 'Switch to day desk' : 'Switch to night desk'}
      aria-label={theme === 'dark' ? 'Switch to day desk' : 'Switch to night desk'}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
      <span className="hidden sm:inline">{theme === 'dark' ? 'Day' : 'Night'}</span>
    </button>
  );
}

function IncidentClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        }).format(new Date())
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-[family-name:var(--font-mono)] text-[0.75rem] tabular-nums text-[var(--ink-2)]">
      {now ?? '--:--:--'} <span className="text-[var(--ink-3)]">IST</span>
    </span>
  );
}

const ALL_ITEMS = [{ href: '/', label: 'Situation', icon: 'layers' }, ...PHASES.flatMap((p) => p.items)];

export default function Shell({ children, fileNo, reasoning }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--rule)] bg-[var(--jacket)]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[100rem] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5 no-underline">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-white"
              style={{ background: 'var(--stamp)' }}
            >
              <Icon name="aegis" size={17} />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="font-[family-name:var(--font-narrow)] text-[0.9375rem] font-bold tracking-[0.01em] text-[var(--ink)]">
                Aegis
              </span>
              <span className="mt-0.5 text-[0.625rem] text-[var(--ink-3)]">District operations</span>
            </span>
          </Link>

          <nav aria-label="Sections" className="ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {ALL_ITEMS.map((item) => {
              const on = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 no-underline transition-colors"
                  style={
                    on
                      ? { background: 'var(--stamp-soft)', color: 'var(--stamp)' }
                      : { color: 'var(--ink-3)' }
                  }
                >
                  <Icon name={item.icon} size={13} />
                  <span className="font-[family-name:var(--font-narrow)] text-[0.75rem] font-semibold whitespace-nowrap">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden lg:block">
              <IncidentClock />
            </span>
            <Link
              href="/system"
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 no-underline sm:flex"
              style={{ background: 'var(--sheet-sunk)' }}
              title={reasoning?.note}
            >
              <StatusDot
                tone={reasoning?.configured ? 'live' : 'warn'}
                pulse={reasoning?.configured}
                label={reasoning?.configured ? 'Reasoning live' : 'Rule engine'}
              />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-[var(--rule)] px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3">
          <p className="text-[0.75rem] leading-[1.5] text-[var(--ink-3)]">
            AEGIS · Smart India Hackathon 2026 · Problem Statement 26206 · Team Sinchan.{' '}
            File {fileNo}. All incident data is synthetic; drone flight, dispatch transmission and imagery ingestion
            are simulated.
          </p>
          <Link
            href="/system"
            className="font-[family-name:var(--font-narrow)] text-[0.6875rem] font-semibold text-[var(--stamp)]"
          >
            What is real and what is simulated →
          </Link>
        </div>
      </footer>
    </div>
  );
}
