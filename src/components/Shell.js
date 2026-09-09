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

export default function Shell({ children, fileNo, reasoning }) {
  const pathname = usePathname();
  const active = phaseOf(pathname);

  return (
    <div className="flex min-h-full flex-col">
      {/* Masthead — the file's cover line */}
      <header className="sticky top-0 z-30 border-b border-[var(--rule-strong)] bg-[var(--jacket)]/95 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-[110rem] items-center gap-3 px-3 py-2 sm:px-5">
          <Link href="/" className="group flex items-center gap-2.5 no-underline">
            <Icon name="aegis" size={22} style={{ color: 'var(--stamp)' }} />
            <span className="flex flex-col leading-none">
              <span className="font-[family-name:var(--font-narrow)] text-[1.0625rem] font-bold uppercase tracking-[0.2em] text-[var(--ink)]">
                Aegis
              </span>
              <span className="mt-[0.1875rem] hidden font-[family-name:var(--font-narrow)] text-[0.5rem] uppercase tracking-[0.13em] text-[var(--ink-3)] lg:block">
                Automated Emergency Guidance &amp; Intelligence Support
              </span>
            </span>
          </Link>

          <span className="mx-1 hidden h-7 w-px bg-[var(--rule)] sm:block" />

          <div className="hidden min-w-0 flex-col leading-none sm:flex">
            <span className="rail">F.No.</span>
            <span className="truncate font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-[0.04em] text-[var(--ink-2)]">
              {fileNo}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2.5 sm:gap-4">
            <span className="hidden md:block">
              <IncidentClock />
            </span>
            <Link
              href="/system"
              className="hidden items-center gap-1.5 no-underline sm:flex"
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

        {/* The phase rail — one unbroken line, never wrapping */}
        <nav aria-label="Disaster phase" className="border-t border-[var(--rule)]">
          <div className="mx-auto flex max-w-[110rem] items-stretch overflow-x-auto px-3 sm:px-5">
            <Link
              href="/"
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-1.5 no-underline ${
                pathname === '/' ? 'border-[var(--stamp)] text-[var(--ink)]' : 'border-transparent text-[var(--ink-3)]'
              }`}
            >
              <Icon name="layers" size={12} />
              <span className="font-[family-name:var(--font-narrow)] text-[0.625rem] font-semibold uppercase tracking-[0.12em]">
                Situation
              </span>
            </Link>

            {PHASES.map((phase, i) => (
              <div key={phase.id} className="flex shrink-0 items-stretch">
                <span
                  aria-hidden="true"
                  className="my-1.5 w-px shrink-0 bg-[var(--rule)]"
                  style={{ marginInline: '0.375rem' }}
                />
                <span className="flex shrink-0 items-center pr-2">
                  <span
                    className="font-[family-name:var(--font-narrow)] text-[0.5625rem] font-bold uppercase tracking-[0.16em]"
                    style={{ color: active === phase.id ? 'var(--stamp)' : 'var(--ink-3)' }}
                  >
                    {phase.label}
                  </span>
                </span>
                {phase.items.map((item) => {
                  const on = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={on ? 'page' : undefined}
                      className={`flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-1.5 no-underline transition-colors ${
                        on
                          ? 'border-[var(--stamp)] text-[var(--ink)]'
                          : 'border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <Icon name={item.icon} size={12} />
                      <span className="font-[family-name:var(--font-narrow)] text-[0.625rem] font-semibold uppercase tracking-[0.11em] whitespace-nowrap">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[110rem] flex-1 px-3 py-5 sm:px-5 sm:py-7">{children}</main>

      <footer className="border-t border-[var(--rule)] px-3 py-4 sm:px-5">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3">
          <p className="text-[0.6875rem] leading-[1.5] text-[var(--ink-3)]">
            AEGIS · Smart India Hackathon 2026 · Problem Statement 26206 · Team Sinchan.{' '}
            <span className="text-[var(--ink-3)]">
              All incident data is synthetic. Drone flight, dispatch transmission and imagery ingestion are simulated.
            </span>
          </p>
          <Link
            href="/system"
            className="font-[family-name:var(--font-narrow)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]"
          >
            What is real and what is simulated
          </Link>
        </div>
      </footer>
    </div>
  );
}
