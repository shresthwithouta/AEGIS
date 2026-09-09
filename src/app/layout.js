import { Archivo, Archivo_Narrow, Azeret_Mono, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';
import { INCIDENT } from '@/lib/aegis/incident';
import { reasoningConfigured, MODEL } from '@/lib/agent/llm';

/* Archivo is a grotesque with a real form-and-document character, and its
   narrow cut gives the ruled register its column heads. Azeret Mono is the
   squared, stamped face the data field needs. Noto Devanagari carries the
   Hindi field instructions — the dispatch is bilingual, so the type must be. */
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin'], display: 'swap' });
const archivoNarrow = Archivo_Narrow({ variable: '--font-archivo-narrow', subsets: ['latin'], display: 'swap' });
const azeret = Azeret_Mono({ variable: '--font-azeret', subsets: ['latin'], display: 'swap' });
const notoDeva = Noto_Sans_Devanagari({
  variable: '--font-noto-deva',
  subsets: ['devanagari'],
  weight: ['400', '600'],
  display: 'swap',
});

export const metadata = {
  title: 'AEGIS — District Emergency Operations',
  description:
    'Decision support for district disaster management: zone severity, drone verification, resource allocation and safe dispatch, with a human approval gate on every commitment.',
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d9ddd2' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1116' },
  ],
};

/* Applied before paint so a night-shift officer never gets a white flash. */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('aegis-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

const DIRECTION_CONTRACT = `<!--
AEGIS · direction contract · seed f17832f9 · assigned index 5 of 7

THESIS: A disaster response system whose product is a signed, auditable order —
so the interface is the government file that carries it, not the glowing map
every disaster dashboard reaches for. It refuses the dark mission-control
template and its opposite, the white tricolour portal.

OWN-WORLD: The Indian district file as a screen grammar. Ruled columns and
hairlines instead of cards; a numbered margin rail on every register; violet
stamp-pad ink for authority, red-tape crimson for halt, file green for verified,
on a noting-sheet ground by day and an ink ground at night. Archivo and Archivo
Narrow for the form, Azeret Mono for every figure, tabular numerals throughout.

STORY: A duty officer sees which zones are worst and why the arithmetic says so,
sends drones to the ones nobody has confirmed, reads a resource recommendation
with its trade-offs named, and stamps it — twice — before anything moves.

FIRST VIEWPORT: Masthead carrying the file number; the unbroken five-stage rail
with a 'now' marker; the 100-zone grid at full scale on the left with severity
in the cell edges; the priority register ruled beside it. The primary action —
open the pipeline — sits at the top right of the situation sheet.

FORM: The signed government file. Candidate 5 of 7 on my ordered list, assigned
by the roll. Seed key f17832f9.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }) {
  const live = reasoningConfigured();
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoNarrow.variable} ${azeret.variable} ${notoDeva.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <Shell
          fileNo={INCIDENT.fileNo}
          reasoning={{
            configured: live,
            model: live ? MODEL : null,
            note: live
              ? `Reasoning layer live (${MODEL}). Recommendations are model-produced and labelled.`
              : 'No reasoning credentials on this deployment — deterministic rule engines produce every recommendation.',
          }}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
