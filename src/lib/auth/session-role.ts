export function hasAdminRole(session: unknown): boolean {
  return (session as { user?: { role?: string } } | null | undefined)?.user?.role === 'admin';
}
