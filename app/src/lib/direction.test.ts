import { Platform } from 'react-native';

import { textAlignFor } from './direction';

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
