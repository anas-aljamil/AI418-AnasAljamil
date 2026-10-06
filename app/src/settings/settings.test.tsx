/**
 * Text size (Settings): Small, Medium (the default) and Big scale the app's text by 0.9, 1
 * and 1.2; a size saved by an earlier version of the app maps to the nearest new one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SettingsProvider, TEXT_SIZES, useSettings } from './SettingsProvider';

function Probe() {
  const { textSize, textScale } = useSettings();
  return <Text>{`${textSize} ${textScale}`}</Text>;
}

beforeEach(() => AsyncStorage.clear());

it('offers small, medium and big, medium by default', async () => {
  expect(TEXT_SIZES).toEqual({ small: 0.9, medium: 1, big: 1.2 });
  await render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  );
  expect(await screen.findByText('medium 1')).toBeTruthy();
});

it.each([
  ['default', 'medium 1'],
  ['large', 'big 1.2'],
  ['larger', 'big 1.2'],
  ['small', 'small 0.9'],
])('reads a saved "%s" as %s', async (saved, shown) => {
  await AsyncStorage.setItem('mawjood.textSize', saved);
  await render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  );
  expect(await screen.findByText(shown)).toBeTruthy();
});
