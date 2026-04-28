/**
 * The "admin" account is a system-level operator account.
 * It should not appear as a house member in any user-facing lists.
 */

/** Check if a displayName belongs to the system admin account */
export const isSystemAdmin = (displayName?: string) =>
	displayName?.toLowerCase() === 'admin';

/** Filter the system admin account out of a roommate/user array */
export const filterHouseMembers = <T extends { displayName?: string }>(users: T[]): T[] =>
	users.filter(u => u.displayName !== undefined && !isSystemAdmin(u.displayName));
