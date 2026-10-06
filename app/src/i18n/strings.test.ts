import ar from './ar.json';
import en from './en.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...all, [path]: value }
      : { ...all, ...flatten(value, path) };
  }, {});
}

const arabic = flatten(ar as Tree);
const english = flatten(en as Tree);
const placeholders = (text: string) => (text.match(/{{\w+}}/g) ?? []).sort();

describe('translation files', () => {
  it('have exactly the same keys', () => {
    expect(Object.keys(arabic).sort()).toEqual(Object.keys(english).sort());
  });

  it('have no empty strings', () => {
    for (const [key, text] of [...Object.entries(arabic), ...Object.entries(english)]) {
      expect({ key, empty: text.trim() === '' }).toEqual({ key, empty: false });
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(english)) {
      expect({ key, placeholders: placeholders(arabic[key] ?? '') }).toEqual({
        key,
        placeholders: placeholders(english[key] ?? ''),
      });
    }
  });

  it('actually translate the Arabic file (no untranslated Latin words)', () => {
    for (const [key, text] of Object.entries(arabic)) {
      if (key === 'settings.language_en') continue; // the English name is written in English
      // Latin letters are allowed only in placeholders, email addresses (they cannot be
      // translated) and codes like "A" in "مبنى A".
      const words =
        text
          .replace(/[\w.]*@(?:{{\w+}}|[\w.]+)/g, '') // an address, its domain maybe a placeholder
          .replace(/{{\w+}}/g, '')
          .match(/[A-Za-z]{2,}/g) ?? [];
      expect({ key, untranslated: words }).toEqual({ key, untranslated: [] });
    }
  });

  it('use the agreed status labels (DESIGN.md Section 8)', () => {
    expect(ar.status).toMatchObject({
      in_office: 'في المكتب',
      in_class: 'في محاضرة',
      busy: 'مشغول',
      away: 'خارج المكتب',
      unknown: 'غير مؤكد',
    });
  });
});
