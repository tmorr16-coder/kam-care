export const LINK_TYPES = ['invite', 'recovery', 'magiclink', 'signup', 'email'] as const
export type LinkType = (typeof LINK_TYPES)[number]
