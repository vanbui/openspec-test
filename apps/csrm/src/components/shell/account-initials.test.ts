import { describe, expect, it } from 'vitest';

import { accountInitials } from './account-initials';

describe('accountInitials', () => {
  it('uses the first letters of the first and last words of a name', () => {
    expect(accountInitials('Jane Doe')).toBe('JD');
    expect(accountInitials('  jane   doe ')).toBe('JD');
    expect(accountInitials('Jane Mary Doe')).toBe('JD');
  });

  it('uses a single initial for a single word', () => {
    expect(accountInitials('Jane')).toBe('J');
  });

  it('splits an email local part on dot, underscore and hyphen', () => {
    expect(accountInitials('jane.doe@idambox.com')).toBe('JD');
    expect(accountInitials('jane_mary-doe@idambox.com')).toBe('JD');
    expect(accountInitials('bob@idambox.com')).toBe('B');
  });

  it('uppercases by locale and is code-point safe', () => {
    expect(accountInitials('émile zola')).toBe('ÉZ');
    expect(accountInitials('𝒜lice Bob')).toBe('𝒜B');
  });

  it('falls back to a question mark when nothing usable remains', () => {
    expect(accountInitials('')).toBe('?');
    expect(accountInitials('   ')).toBe('?');
    expect(accountInitials('— —')).toBe('?');
  });
});
