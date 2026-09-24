export function validatedReturnTo(returnTo: string | null | undefined, fallback = '/app'): string {
  return returnTo?.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\') ? returnTo : fallback;
}
