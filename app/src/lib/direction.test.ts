import { I18nManager, Platform } from 'react-native';

import { insetEnd, insetStart, textAlignFor } from './direction';

describe('text alignment by reading direction', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
    jest.restoreAllMocks();
  });

  it('on phones in a right-to-left layout uses the swapped side (React Native swaps it back)', () => {
    Platform.OS = 'ios';
    jest.replaceProperty(I18nManager, 'isRTL', true);
    expect([textAlignFor('start', 'ar'), textAlignFor('end', 'ar')]).toEqual(['left', 'right']);
    // English on an Arabic phone before the reload: 'right' is swapped to the left side.
    expect([textAlignFor('start', 'en'), textAlignFor('end', 'en')]).toEqual(['right', 'left']);
  });

  it('on phones whose layout is still left-to-right uses the physical side', () => {
    Platform.OS = 'android';
    jest.replaceProperty(I18nManager, 'isRTL', false);
    expect([textAlignFor('start', 'ar'), textAlignFor('end', 'ar')]).toEqual(['right', 'left']);
    expect([textAlignFor('start', 'en'), textAlignFor('end', 'en')]).toEqual(['left', 'right']);
  });

  it('on the web build uses the physical side for the language', () => {
    Platform.OS = 'web';
    expect([textAlignFor('start', 'ar'), textAlignFor('end', 'ar')]).toEqual(['right', 'left']);
    expect([textAlignFor('start', 'en'), textAlignFor('end', 'en')]).toEqual(['left', 'right']);
  });
});

describe('absolute positions from the reading start and end', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('on phones uses start/end, which React Native mirrors in RTL', () => {
    Platform.OS = 'android';
    expect(insetStart('25%', 'ar')).toEqual({ start: '25%' });
    expect(insetEnd(-4, 'ar')).toEqual({ end: -4 });
  });

  it('on the web build uses the physical side for the language', () => {
    Platform.OS = 'web';
    expect(insetStart('25%', 'ar')).toEqual({ right: '25%' });
    expect(insetStart('25%', 'en')).toEqual({ left: '25%' });
    expect(insetEnd(-4, 'ar')).toEqual({ left: -4 });
  });
});
