import { hasAdminRole } from '@/lib/auth/session-role';

describe('AI interface admin affordance gate', () => {
  it('recognizes only an authenticated admin role', () => {
    expect(hasAdminRole({ user: { role: 'admin' } })).toBe(true);
    expect(hasAdminRole({ user: { role: 'user' } })).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
  });
});
