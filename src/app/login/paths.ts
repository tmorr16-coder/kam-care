/** Where a password-reset email link lands, after /auth/callback signs the user in. */
export const RESET_PATH = '/auth/reset-password'

/** Where invite and staff-sent reset links land. Signs the person in from the link, then sends them to RESET_PATH. */
export const ACCEPT_PATH = '/auth/accept'
