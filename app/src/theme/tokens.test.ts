/**
 * WCAG 2.2 AA on the real theme tokens, plus a sync check with
 * docs/design-plan/palettes.json (where scripts/check_palette.py also checks
 * colour-blind separation of the status colours).
 */
import palettesJson from '../../../docs/design-plan/palettes.json';
import { palettes, type ColorScheme } from './tokens';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

const schemes: ColorScheme[] = ['light', 'dark'];

describe.each(schemes)('%s theme contrast (WCAG 2.2 AA)', (scheme) => {
  const p = palettes[scheme];
  const backgrounds = { bg: p.bg, surface: p.surface };

  it.each(Object.entries(backgrounds))('text roles reach 4.5:1 on %s', (_, background) => {
    for (const role of ['text', 'muted', 'primary', 'danger'] as const) {
      expect({ role, ok: contrast(p[role], background) >= 4.5 }).toEqual({ role, ok: true });
    }
  });

  it.each(Object.entries(backgrounds))(
    'status colours reach 3:1 (UI components) on %s',
    (_, background) => {
      for (const [status, color] of Object.entries(p.status)) {
        expect({ status, ok: contrast(color, background) >= 3 }).toEqual({ status, ok: true });
      }
    },
  );

  it('text on filled buttons and selected chips reaches 4.5:1', () => {
    expect(contrast(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('toast text (background colour on text colour) reaches 4.5:1', () => {
    expect(contrast(p.bg, p.text)).toBeGreaterThanOrEqual(4.5);
  });

  it('the door marks drawn in the surface colour stay visible on every status colour (3:1)', () => {
    for (const status of ['in_class', 'busy', 'away'] as const) {
      expect({ status, ok: contrast(p.surface, p.status[status]) >= 3 }).toEqual({
        status,
        ok: true,
      });
    }
  });
});

describe('tokens match the approved palette (DESIGN.md Section 11)', () => {
  it.each(schemes)('%s', (scheme) => {
    const approved = (palettesJson as Record<string, Record<string, string>>)[`A ${scheme}`]!;
    const p = palettes[scheme];
    expect({
      bg: p.bg,
      surface: p.surface,
      text: p.text,
      muted: p.muted,
      primary: p.primary,
      on_primary: p.onPrimary,
      line: p.line,
      lamp: p.lamp,
      in_office: p.status.in_office,
      in_class: p.status.in_class,
      busy: p.status.busy,
      away: p.status.away,
    }).toEqual(approved);
  });
});
