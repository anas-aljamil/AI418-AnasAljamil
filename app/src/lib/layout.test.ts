import { columnStyle, layoutFor } from './layout';

describe('layout by window width (docs/desktop-plan.md)', () => {
  it('is phone below 768, tablet from 768, desktop from 1024', () => {
    expect(layoutFor(320)).toBe('phone');
    expect(layoutFor(767)).toBe('phone');
    expect(layoutFor(768)).toBe('tablet');
    expect(layoutFor(1023)).toBe('tablet');
    expect(layoutFor(1024)).toBe('desktop');
    expect(layoutFor(1920)).toBe('desktop');
  });

  it('leaves phones full width and centres a capped column elsewhere', () => {
    expect(columnStyle('phone')).toBeNull();
    expect(columnStyle('tablet')).toEqual({ width: '100%', maxWidth: 720, alignSelf: 'center' });
    expect(columnStyle('desktop')).toEqual({ width: '100%', maxWidth: 760, alignSelf: 'center' });
    expect(columnStyle('desktop', 'narrow')).toMatchObject({ maxWidth: 520 });
    expect(columnStyle('phone', 'narrow')).toBeNull();
  });
});
