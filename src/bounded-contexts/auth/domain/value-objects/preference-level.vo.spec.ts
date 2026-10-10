import { PreferenceLevel } from './preference-level.vo';
import { AuthError } from '../errors/auth.error';

describe('PreferenceLevel Value Object', () => {
  it('creates valid preference levels', () => {
    expect(PreferenceLevel.from('high').value).toBe('high');
    expect(PreferenceLevel.from('NORMAL').value).toBe('normal');
    expect(PreferenceLevel.from('  avoid  ').value).toBe('avoid');
  });

  it('throws AuthError for invalid preference level', () => {
    expect(() => PreferenceLevel.from('invalid')).toThrow(AuthError);
    expect(() => PreferenceLevel.from(123)).toThrow(AuthError);
  });

  it('correctly compares equality', () => {
    const level1 = PreferenceLevel.from('high');
    const level2 = PreferenceLevel.HIGH;
    const level3 = PreferenceLevel.NORMAL;

    expect(level1.equals(level2)).toBe(true);
    expect(level1.equals(level3)).toBe(false);
  });
});
