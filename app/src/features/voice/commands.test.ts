import type { ProfessorSummary } from '@/api/types';
import { normalizeSpeech, parseAlternatives, parseCommand, words } from './commands';

function professor(id: number, ar: string, en: string): ProfessorSummary {
  return {
    professor_id: id,
    full_name_ar: ar,
    full_name_en: en,
    honorific: 'dr',
    department: {
      department_id: 1,
      code: 'AI',
      name_ar: 'الذكاء الاصطناعي',
      name_en: 'Artificial Intelligence',
      college: { college_id: 1, code: 'CCCS', name_ar: 'كلية', name_en: 'College' },
    },
    office: null,
    status: {
      status: 'in_office',
      confirmed: true,
      source: 'override',
      note: null,
      until: null,
      updated_at: null,
    },
    has_office_hours_today: true,
  };
}

const noura = professor(1, 'نورة الحربي', 'Noura Al-Harbi');
const khalid = professor(2, 'خالد العتيبي', 'Khalid Al-Otaibi');
const huda = professor(3, 'هدى القحطاني', 'Huda Al-Qahtani');
const khalidB = professor(4, 'خالد الزهراني', 'Khalid Al-Zahrani');
const all = [noura, khalid, huda, khalidB];

describe('normalizing speech', () => {
  it('folds Arabic letter forms and drops diacritics and punctuation', () => {
    expect(normalizeSpeech('هلْ الدكتورةُ نورة موجودة؟')).toBe('هل الدكتوره نوره موجوده');
    expect(normalizeSpeech('أحمد إبراهيم آل')).toBe('احمد ابراهيم ال');
  });

  it('drops the article from each word', () => {
    expect(words('Dr. Noura Al-Harbi')).toEqual(['dr', 'noura', 'harbi']);
    expect(words('للدكتورة نورة الحربي')).toEqual(['دكتوره', 'نوره', 'حربي']);
  });
});

describe('voice commands', () => {
  it('answers "is she in?" in Arabic', () => {
    const result = parseCommand('هل الدكتورة نورة موجودة', all);
    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.professor.professor_id).toBe(1);
      expect(result.intent).toBe('status');
    }
  });

  it('answers in English and tolerates a one-letter spelling difference', () => {
    const result = parseCommand('is doctor Nora in', all);
    expect(result.kind === 'match' && result.professor.professor_id).toBe(1);
  });

  it('understands booking and messaging', () => {
    const book = parseCommand('احجز موعد مع د. هدى', all);
    expect(book.kind === 'match' && book.intent).toBe('book');
    const message = parseCommand('message Dr Huda Al-Qahtani', all);
    expect(message.kind === 'match' && message.intent).toBe('message');
  });

  it('asks which professor when two names fit equally', () => {
    const result = parseCommand('is Khalid in', all);
    expect(result.kind).toBe('choose');
    if (result.kind === 'choose') {
      expect(result.options.map((option) => option.professor_id).sort()).toEqual([2, 4]);
    }
  });

  it('picks the right one once the family name is said', () => {
    const result = parseCommand('هل خالد العتيبي موجود', all);
    expect(result.kind === 'match' && result.professor.professor_id).toBe(2);
  });

  it('says it did not understand when no name matches', () => {
    expect(parseCommand('what is the weather', all).kind).toBe('not_understood');
    expect(parseCommand('', all).kind).toBe('not_understood');
  });

  it('uses the first guess of the recognizer that names a professor', () => {
    const result = parseAlternatives(['is the doctor in', 'is doctor Huda in'], all);
    expect(result.kind === 'match' && result.professor.professor_id).toBe(3);
    expect(parseAlternatives(['hello'], all).kind).toBe('not_understood');
  });
});
