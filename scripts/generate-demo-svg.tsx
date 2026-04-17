/** @jsx h */
/** @jsxFrag Fragment */

/**
 * Generates docs/assets/demo.svg — a compact overview of what EMDD is,
 * when to use it, and the simple /emdd-open → work → /emdd-close routine.
 *
 * Run: tsx scripts/generate-demo-svg.tsx
 *      npm run demo:svg
 *      npm run demo:svg -- --no-embed-font
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';

const Fragment = Symbol('Fragment');

function h(
  type: any,
  props: Record<string, any> | null,
  ...children: any[]
): any {
  const flat = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  const mergedProps = { ...(props ?? {}) };
  if (flat.length === 1) mergedProps.children = flat[0];
  else if (flat.length > 1) mergedProps.children = flat;
  if (typeof type === 'function') return type(mergedProps);
  return { type, props: mergedProps };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const outPath = resolve(rootDir, 'docs/assets/demo.svg');
const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));
const embedFont = !args.has('--no-embed-font');
const pointScaleFactor = 2;

function loadFont(specifier: string): Buffer {
  return readFileSync(require.resolve(specifier));
}

const interRegular = loadFont('@fontsource/inter/files/inter-latin-400-normal.woff');
const interBold = loadFont('@fontsource/inter/files/inter-latin-700-normal.woff');
const monoRegular = loadFont(
  '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
);
const monoBold = loadFont(
  '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff',
);

const fonts = [
  { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: interBold, weight: 700 as const, style: 'normal' as const },
  { name: 'JetBrains Mono', data: monoRegular, weight: 400 as const, style: 'normal' as const },
  { name: 'JetBrains Mono', data: monoBold, weight: 700 as const, style: 'normal' as const },
];

const C = {
  bg: '#0b1020',
  panel: '#121a2d',
  panelBorder: '#26314d',
  panelInner: '#0d1423',
  text: '#edf2ff',
  textMuted: '#b0bbdb',
  textSoft: '#7d88aa',
  chipBg: '#101827',
  chipBorder: '#2b3757',
  blue: '#79c8ff',
  blueTint: 'rgba(121, 200, 255, 0.16)',
  green: '#9ad06f',
  greenTint: 'rgba(154, 208, 111, 0.14)',
  warm: '#ffb86b',
  warmTint: 'rgba(255, 184, 107, 0.14)',
  purple: '#c4a2ff',
  purpleTint: 'rgba(196, 162, 255, 0.14)',
  line: '#556587',
} as const;

const W = 1080;
const H = 560;
const SETUP_W = 320;
const SESSION_W = 684;
const CARD_H = 272;
const STEP_W = 186;
const STEP_H = 94;

function Glow({
  left,
  top,
  size,
  color,
  opacity,
}: {
  left: number;
  top: number;
  size: number;
  color: string;
  opacity: number;
}) {
  return h('div', {
    style: {
      position: 'absolute',
      left,
      top,
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      opacity,
    },
  });
}

function Eyebrow({ text, color }: { text: string; color: string }) {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
    },
    h('div', {
      style: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
      },
    }),
    h(
      'span',
      {
        style: {
          color,
          fontSize: 11,
          fontFamily: 'Inter',
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        },
      },
      text,
    ),
  );
}

function UseChip({ text }: { text: string }) {
  return h(
    'div',
    {
      style: {
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${C.chipBorder}`,
        backgroundColor: C.chipBg,
        color: C.textMuted,
        fontSize: 11,
        fontFamily: 'Inter',
        fontWeight: 700,
        letterSpacing: 0.3,
      },
    },
    text,
  );
}

function SectionCard({
  index,
  eyebrow,
  eyebrowColor,
  title,
  subtitle,
  width,
  children,
}: {
  index: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  subtitle: string;
  width: number;
  children: any;
}) {
  return h(
    'div',
    {
      style: {
        width,
        height: CARD_H,
        padding: 22,
        borderRadius: 24,
        backgroundColor: C.panel,
        border: `1px solid ${C.panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      },
    },
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: 18,
          right: 18,
          width: 34,
          height: 34,
          borderRadius: 17,
          border: `1px solid ${C.chipBorder}`,
          backgroundColor: C.chipBg,
          color: C.textSoft,
          fontSize: 12,
          fontFamily: 'JetBrains Mono',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
      index,
    ),
    h(Eyebrow, { text: eyebrow, color: eyebrowColor }),
    h(
      'div',
      {
        style: {
          marginTop: 14,
          color: C.text,
          fontSize: 26,
          lineHeight: 1.1,
          fontFamily: 'Inter',
          fontWeight: 700,
          maxWidth: width - 92,
        },
      },
      title,
    ),
    h(
      'div',
      {
        style: {
          marginTop: 8,
          color: C.textMuted,
          fontSize: 13,
          lineHeight: 1.42,
          fontFamily: 'Inter',
          maxWidth: width - 52,
        },
      },
      subtitle,
    ),
    h(
      'div',
      {
        style: {
          marginTop: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
        },
      },
      children,
    ),
  );
}

function TerminalBlock({ lines }: { lines: string[] }) {
  return h(
    'div',
    {
      style: {
        padding: 14,
        borderRadius: 18,
        backgroundColor: C.panelInner,
        border: `1px solid ${C.panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'row',
          gap: 7,
        },
      },
      h('div', {
        style: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff6b6b' },
      }),
      h('div', {
        style: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffbf47' },
      }),
      h('div', {
        style: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4cd964' },
      }),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        },
      },
      ...lines.map((line) =>
        h(
          'span',
          {
            style: {
              color: line.startsWith('$') || line.startsWith('  ') ? C.text : C.textMuted,
              fontSize: 12.5,
              lineHeight: 1.42,
              fontFamily: 'JetBrains Mono',
            },
          },
          line,
        ),
      ),
    ),
  );
}

function StepCard({
  label,
  title,
  detail,
  accent,
  tint,
  mono,
}: {
  label: string;
  title: string;
  detail: string;
  accent: string;
  tint: string;
  mono?: boolean;
}) {
  return h(
    'div',
    {
      style: {
        width: STEP_W,
        height: STEP_H,
        padding: 14,
        borderRadius: 20,
        border: `1px solid ${accent}`,
        backgroundColor: tint,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      },
    },
    h(
      'div',
      {
        style: {
          color: accent,
          fontSize: 10.5,
          fontFamily: 'Inter',
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
      },
      label,
    ),
    h(
      'div',
      {
        style: {
          color: C.text,
          fontSize: mono ? 19 : 24,
          lineHeight: 1.05,
          fontFamily: mono ? 'JetBrains Mono' : 'Inter',
          fontWeight: 700,
        },
      },
      title,
    ),
    h(
      'div',
      {
        style: {
          color: C.textMuted,
          fontSize: 11.5,
          lineHeight: 1.32,
          fontFamily: 'Inter',
        },
      },
      detail,
    ),
  );
}

function ArrowConnector() {
  return h(
    'div',
    {
      style: {
        width: 28,
        height: STEP_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    h(
      'svg',
      {
        width: 24,
        height: 18,
        viewBox: '0 0 24 18',
      },
      h('path', {
        d: 'M 1 9 L 18 9 M 12 3 L 18 9 L 12 15',
        stroke: C.line,
        strokeWidth: 1.8,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
    ),
  );
}

function LoopHint() {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 2,
      },
    },
    h(
      'svg',
      {
        width: 18,
        height: 18,
        viewBox: '0 0 18 18',
      },
      h('path', {
        d: 'M 14 6 A 5 5 0 1 0 14 12',
        stroke: C.green,
        strokeWidth: 1.6,
        fill: 'none',
        strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M 11.5 4.5 L 14.5 6 L 12 8',
        stroke: C.green,
        strokeWidth: 1.6,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
    ),
    h(
      'span',
      {
        style: {
          color: C.textSoft,
          fontSize: 12,
          lineHeight: 1.3,
          fontFamily: 'Inter',
        },
      },
      'Next session starts from the Episode you just closed.',
    ),
  );
}

function SetupCard() {
  return h(
    SectionCard,
    {
      index: '01',
      eyebrow: 'Set Up Once',
      eyebrowColor: C.blue,
      title: 'Init & connect.',
      subtitle: 'Run once per project.',
      width: SETUP_W,
    },
    h(TerminalBlock, {
      lines: [
        '$ emdd init my-research --tool claude',
        '$ claude mcp add emdd --',
        '  npx @beomjk/emdd mcp',
      ],
    }),
  );
}

function SessionCard() {
  return h(
    SectionCard,
    {
      index: '02',
      eyebrow: 'Every Work Session',
      eyebrowColor: C.green,
      title: 'Open context. Work. Close the session.',
      subtitle: 'Use EMDD when you are exploring an uncertain direction with AI help.',
      width: SESSION_W,
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        },
      },
      h(StepCard, {
        label: 'Start',
        title: '/emdd-open',
        detail: 'Load context and next steps.',
        accent: C.blue,
        tint: C.blueTint,
        mono: true,
      }),
      h(ArrowConnector, null),
      h(StepCard, {
        label: 'Work',
        title: 'Research',
        detail: 'Code, test, read, inspect, decide.',
        accent: C.warm,
        tint: C.warmTint,
      }),
      h(ArrowConnector, null),
      h(StepCard, {
        label: 'End',
        title: '/emdd-close',
        detail: 'Write the Episode. Run maintenance if needed.',
        accent: C.purple,
        tint: C.purpleTint,
        mono: true,
      }),
    ),
    h(LoopHint, null),
  );
}

function Root() {
  return h(
    'div',
    {
      style: {
        width: W,
        height: H,
        padding: 28,
        backgroundColor: C.bg,
        color: C.text,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter',
      },
    },
    h(Glow, { left: 820, top: -80, size: 240, color: C.blue, opacity: 0.1 }),
    h(Glow, { left: 160, top: 320, size: 200, color: C.purple, opacity: 0.08 }),
    h(Glow, { left: 470, top: 360, size: 160, color: C.warm, opacity: 0.06 }),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
        },
      },
      h(Eyebrow, { text: 'EMDD for Exploratory R&D', color: C.blue }),
      h(
        'div',
        {
          style: {
            color: C.text,
            fontSize: 32,
            lineHeight: 1.08,
            fontFamily: 'Inter',
            fontWeight: 700,
            maxWidth: 760,
          },
        },
        'Keep track of what you tried, what you learned, and what to do next.',
      ),
      h(
        'div',
        {
          style: {
            color: C.textMuted,
            fontSize: 15,
            lineHeight: 1.45,
            fontFamily: 'Inter',
            maxWidth: 780,
          },
        },
        'A lightweight knowledge graph for AI-assisted research and development.',
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'row',
            gap: 10,
            marginTop: 4,
          },
        },
        h(UseChip, { text: 'Experiments' }),
        h(UseChip, { text: 'Prototypes' }),
        h(UseChip, { text: 'Paper Reading' }),
        h(UseChip, { text: 'Architecture Spikes' }),
      ),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'row',
          gap: 20,
          marginTop: 24,
          position: 'relative',
        },
      },
      h(SetupCard, null),
      h(SessionCard, null),
    ),
  );
}

const svg = await satori(h(Root, null), {
  width: W,
  height: H,
  fonts,
  embedFont,
  pointScaleFactor,
});

writeFileSync(outPath, svg, 'utf-8');
const sizeKB = (Buffer.byteLength(svg, 'utf-8') / 1024).toFixed(1);
const textMode = embedFont ? 'embedded font paths' : 'svg text nodes';
console.log(`\u2714 Generated ${outPath} (${sizeKB} KB, ${textMode})`);
