import { Platform } from 'react-native';

import { insetEnd, insetStart, textAlignFor } from './direction';

describe('text alignment by reading direction', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('on phones uses left/right as start/end, because React Native swaps them in RTL', () => {
    Platform.OS = 'ios';
    expect([textAlignFor('start', 'ar'), textAlignFor('end', 'ar')]).toEqual(['left', 'right']);
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
