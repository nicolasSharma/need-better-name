// ─── User ───────────────────────────────────────────────────────────

export interface UserProfile {
	displayName: string;
	email: string;
	balance: number;
	color: string;
	isAdmin?: boolean;
	createdAt: any;
	photoURL?: string;
	notificationPrefs?: {
		bounties: boolean;
		chores: boolean;
		markets: boolean;
		usd: boolean;
	};
	setupComplete?: boolean;
	viewedTutorials?: string[];
	lastSpinAt?: any;
	spinStreak?: number;
	lastActiveAt?: any;
}

export interface Roommate extends UserProfile {
	id: string;
}

// ─── Markets ────────────────────────────────────────────────────────

export interface Market {
	id: string;
	question: string;
	creatorId: string;
	status: 'open' | 'locked' | 'resolved' | 'pending_resolution' | 'disputed';
	outcome: string | null;
	totalPot: number;
	options: string[];
	pools: Record<string, number>;
	taxCollected: number;
	createdAt: any;
	resolvedAt: any;
	taggedUserId?: string | null;
	proposedOutcome?: string;
	reviewerId?: string | null;
	resolvedBy?: string | null;
	expiresAt?: any;
	challengeDeadline?: any;
	disputedOutcome?: string | null;
}

export interface Bet {
	id: string;
	userId: string;
	optionId: string;
	amount: number;
	isHouseSeed: boolean;
	createdAt: any;
	side?: string;
}

// ─── Chores ─────────────────────────────────────────────────────────

export interface Chore {
	id: string;
	name: string;
	reward: number;
	assigneeId: string | null;
	status: 'open' | 'claimed' | 'pending_review' | 'challenged' | 'completed';
	completedBy: string | null;
	reviewerId?: string | null;
	completedAt: any;
	createdAt: any;
	creatorId?: string;
	type?: 'house' | 'bounty';
	recurring?: 'none' | 'daily' | 'weekly';
	assignedTo?: string[] | 'all';
	photoUrl?: string | null;
	dueDate?: string | null;
	priority?: 'low' | 'medium' | 'high';
	hidden?: boolean;
	challengedBy?: string | null;
	challengeVotes?: Record<string, 'approve' | 'reject'>;
	challengeDeadline?: any;
}

// ─── Transactions ───────────────────────────────────────────────────

export interface Transaction {
	id: string;
	type: string;
	userId: string;
	amount: number;
	relatedId: string;
	description?: string;
	createdAt: any;
	photoUrl?: string | null;
	resolvedBy?: string | null;
}

// ─── Perks ──────────────────────────────────────────────────────────

export interface Perk {
	id: string;
	name: string;
	description: string;
	cost: number;
	icon: string;
}

// ─── House Fund ─────────────────────────────────────────────────────

export interface HouseFund {
	name: string;
	fundBalance: number;
	taxRate: number;
	seedAmount: number;
}

// ─── Inbox ──────────────────────────────────────────────────────────

export interface InboxEvent {
	id: string;
	targetId: string;
	category: string;
	title: string;
	body: string;
	read: boolean;
	createdAt: any;
}

// ─── Splitwise ──────────────────────────────────────────────────────

export interface Route {
	fromId: string;
	toId: string;
	amount: number;
}

// ─── Polls ──────────────────────────────────────────────────────────

export interface Poll {
	id: string;
	question: string;
	options: string[];
	votes: Record<string, string[]>; // optionIndex -> userId[]
	creatorId: string;
	status: 'open' | 'closed';
	createdAt: any;
}
