import {
	doc, collection, addDoc, updateDoc, increment, getDoc, getDocs, query, where,
	serverTimestamp, runTransaction, writeBatch,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '@/config/firebase';

// ─── Auth ───────────────────────────────────────────────────────────

const nameToEmail = (name: string) => `${name.toLowerCase().replace(/\s+/g, '.')}@hub.app`;

export async function signUp(name: string, password: string) {
	const email = nameToEmail(name);
	const cred = await createUserWithEmailAndPassword(auth, email, password);
	const colors = ['red', 'blue', 'purple', 'yellow', 'green', 'orange', 'teal', 'pink'];
	await updateDoc(doc(db, 'users', cred.user.uid), {}).catch(() => null); // ensure doc path
	const batch = writeBatch(db);
	batch.set(doc(db, 'users', cred.user.uid), {
		displayName: name,
		email,
		balance: 500,
		color: colors[Math.floor(Math.random() * colors.length)],
		createdAt: serverTimestamp(),
		setupComplete: false,
		viewedTutorials: [], // List of page keys like 'dashboard', 'casino', 'chores'
	});
	await batch.commit();
	// Initialize house fund if it doesn't exist
	const houseSnap = await getDoc(doc(db, 'house', 'main'));
	if (!houseSnap.exists()) {
		await import('./engine').then((m) => m.initHubFund());
	}
	return cred.user;
}

export async function logIn(name: string, password: string) {
	const email = nameToEmail(name);
	return signInWithEmailAndPassword(auth, email, password);
}

export async function logOut() {
	return signOut(auth);
}

// ─── Admin ──────────────────────────────────────────────────────────

export async function grantAdmin(userId: string) {
	return updateDoc(doc(db, 'users', userId), { isAdmin: true });
}

export async function adjustUserBalance(adminId: string, targetUserId: string, amount: number, reason: string) {
	return runTransaction(db, async (tx) => {
		const adminRef = doc(db, 'users', adminId);
		const adminSnap = await tx.get(adminRef);
		if (!adminSnap.data()?.isAdmin) throw new Error('Unauthorized');

		const targetRef = doc(db, 'users', targetUserId);
		tx.update(targetRef, { balance: increment(amount) });

		tx.set(doc(collection(db, 'transactions')), {
			type: 'admin_adjustment',
			userId: targetUserId,
			amount,
			reason,
			relatedId: adminId,
			createdAt: serverTimestamp(),
		});
	});
}

// ─── Chores ─────────────────────────────────────────────────────────

export async function createChore(
	name: string,
	reward: number,
	creatorId: string,
	type: 'house' | 'bounty',
	recurring: 'none' | 'daily' | 'weekly',
	assignedTo: string[] | 'all',
	dueDate: string | null = null
) {
	return runTransaction(db, async (tx) => {
		// If it's a bounty, the creator must pay out of pocket into escrow
		if (type === 'bounty') {
			const userRef = doc(db, 'users', creatorId);
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists() || userSnap.data().balance < reward) {
				throw new Error('Insufficient BT to fund bounty');
			}
			tx.update(userRef, { balance: increment(-reward) });
			
			tx.set(doc(collection(db, 'transactions')), {
				type: 'bounty_escrow',
				userId: creatorId,
				amount: -reward,
				relatedId: 'new_bounty', // We don't have the ref ID yet in this scope easily without creating it first, let's create it
				createdAt: serverTimestamp(),
			});

			pushAlert(tx, 'global', 'bounties', 'New Bounty Posted', `A bounty of ${reward} BT is open.`);
		}

		const choreRef = doc(collection(db, 'chores'));
		tx.set(choreRef, {
			name,
			reward,
			creatorId,
			type,
			recurring,
			assignedTo,
			assigneeId: null, // Legacy, keep null
			status: 'open',
			completedBy: null,
			completedAt: null,
			photoUrl: null,
			dueDate,
			createdAt: serverTimestamp(),
		});

		return choreRef.id;
	});
}

export async function claimChore(choreId: string, userId: string) {
	return updateDoc(doc(db, 'chores', choreId), {
		assigneeId: userId,
		status: 'claimed',
	});
}

export async function submitChoreForReview(choreId: string, userId: string, reviewerId: string, photoUrl: string | null = null) {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		
		const chore = choreSnap.data();
		if (chore.status !== 'claimed') throw new Error('Task not claimed');

		tx.update(choreRef, {
			status: 'pending_review',
			completedBy: userId,
			reviewerId: reviewerId,
			photoUrl: photoUrl,
		});

		pushAlert(tx, 'global', 'chores', 'Review Requested', `Someone completed a task and requested review.`);
	});
}

export async function approveChore(choreId: string, reviewerId: string) {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		
		const chore = choreSnap.data();
		if (chore.status !== 'pending_review') throw new Error('Task not pending review');
		if (chore.reviewerId !== reviewerId) throw new Error('Not authorized to review');

		const workerId = chore.completedBy;
		const workerRef = doc(db, 'users', workerId);

		// Pay the user
		tx.update(workerRef, { balance: increment(chore.reward) });
		
		// If it's a house chore, deduct from the house limitlessly
		if (chore.type !== 'bounty') {
			const houseRef = doc(db, 'house', 'main');
			tx.update(houseRef, { fundBalance: increment(-chore.reward) });
		}

		// Mark as completed
		tx.update(choreRef, {
			status: 'completed',
			completedAt: serverTimestamp(),
		});

		// Log transaction
		tx.set(doc(collection(db, 'transactions')), {
			type: chore.type === 'bounty' ? 'bounty_reward' : 'chore_reward',
			userId: workerId,
			amount: chore.reward,
			relatedId: choreId,
			createdAt: serverTimestamp(),
		});

		pushAlert(tx, workerId, 'wallet', 'Task Approved', `Your task was approved! +${chore.reward} BT.`);

		// Handle Recurrence spawning
		if (chore.recurring && chore.recurring !== 'none') {
			const cloneRef = doc(collection(db, 'chores'));
			tx.set(cloneRef, {
				name: chore.name,
				reward: chore.reward,
				creatorId: chore.creatorId,
				type: chore.type,
				recurring: chore.recurring,
				assignedTo: chore.assignedTo || 'all',
				assigneeId: null,
				status: 'open',
				completedBy: null,
				reviewerId: null,
				completedAt: null,
				photoUrl: null,
				dueDate: null, // Recurrences don't inherit hard due dates easily, reset to null
				createdAt: serverTimestamp(), // Restarts the clock
			});
		}
	});
}

export async function rejectChore(choreId: string, reviewerId: string) {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		
		const chore = choreSnap.data();
		if (chore.status !== 'pending_review') throw new Error('Task not pending review');
		if (chore.reviewerId !== reviewerId) throw new Error('Not authorized to review');

		tx.update(choreRef, {
			status: 'claimed',
			photoUrl: null,
			reviewerId: null,
		});

		pushAlert(tx, chore.completedBy, 'chores', 'Task Rejected', `Your task completion was rejected. Please try again.`);
	});
}

export async function bountifyChore(choreId: string, userId: string, bountyAmount: number) {
	return runTransaction(db, async (tx) => {
		const userRef = doc(db, 'users', userId);
		const userSnap = await tx.get(userRef);
		if (userSnap.data()?.balance < bountyAmount) throw new Error('Insufficient BT');
		
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task missing');
		
		const chore = choreSnap.data()!;
		
		// Deduct user
		tx.update(userRef, { balance: increment(-bountyAmount) });
		
		// Update chore dynamically (the assignedTo array keeps the original user just in case, but opens it to all)
		tx.update(choreRef, {
			type: 'bounty',
			reward: chore.reward + bountyAmount, // Combine house base + user's out of pocket
			creatorId: userId, // User becomes the sponsor

			assignedTo: 'all', // Open to global floor
			status: 'open', 
			assigneeId: null, // Wipe the original specific assignee so anyone can grab it
		});

		// Log Escrow
		tx.set(doc(collection(db, 'transactions')), {
			type: 'bounty_escrow',
			userId,
			amount: -bountyAmount,
			relatedId: choreId,
			createdAt: serverTimestamp(),
		});

		pushAlert(tx, 'global', 'bounties', 'Task Outsourced', `A roommate just outsourced a task for ${bountyAmount} BT!`);
	});
}

// ─── Markets ────────────────────────────────────────────────────────

export async function createMarket(
	question: string,
	creatorId: string,
	betAmount: number,
	selectedOptionId: string,
	options: string[],
	taggedUserId: string | null = null
) {
	return runTransaction(db, async (tx) => {
		const userRef = doc(db, 'users', creatorId);
		const userSnap = await tx.get(userRef);
		if (!userSnap.exists()) throw new Error('User not found');
		const user = userSnap.data()!;
		if (user.balance < betAmount) throw new Error('Insufficient BT');

		const houseRef = doc(db, 'house', 'main');
		const houseSnap = await tx.get(houseRef);
		const house = houseSnap.data()!;
		const seedPerOption = house.seedAmount || 50;
		const totalSeed = seedPerOption * (options.length - 1); // House seeds all OTHER options

		// Deduct from user + house
		tx.update(userRef, { balance: increment(-betAmount) });
		tx.update(houseRef, { fundBalance: increment(-totalSeed) });

		// Initialize Pools
		const pools: Record<string, number> = {};
		options.forEach(opt => {
			pools[opt] = (opt === selectedOptionId) ? betAmount : seedPerOption;
		});

		// Create market
		const marketRef = doc(collection(db, 'markets'));
		tx.set(marketRef, {
			question,
			creatorId,
			status: 'open',
			outcome: null,
			totalPot: betAmount + totalSeed,
			options,
			pools,
			taxCollected: 0,
			taggedUserId,
			createdAt: serverTimestamp(),
			resolvedAt: null,
		});

		// Creator's bet
		tx.set(doc(collection(db, 'markets', marketRef.id, 'bets')), {
			userId: creatorId,
			optionId: selectedOptionId,
			amount: betAmount,
			isHouseSeed: false,
			createdAt: serverTimestamp(),
		});

		tx.set(doc(collection(db, 'transactions')), {
			type: 'bet_placed', userId: creatorId, amount: -betAmount,
			relatedId: marketRef.id, createdAt: serverTimestamp(),
		});

		// House seed bets for all other options
		options.filter(opt => opt !== selectedOptionId).forEach(opt => {
			tx.set(doc(collection(db, 'markets', marketRef.id, 'bets')), {
				userId: 'house',
				optionId: opt,
				amount: seedPerOption,
				isHouseSeed: true,
				createdAt: serverTimestamp(),
			});
		});

		tx.set(doc(collection(db, 'transactions')), {
			type: 'house_seed', userId: 'house', amount: -totalSeed,
			relatedId: marketRef.id, createdAt: serverTimestamp(),
		});

		pushAlert(tx, 'global', 'markets', 'New Market Floated', `Contract floated: "${question}"`);

		return marketRef.id;
	});
}

export async function placeBet(marketId: string, userId: string, optionId: string, amount: number) {
	return runTransaction(db, async (tx) => {
		const userRef = doc(db, 'users', userId);
		const userSnap = await tx.get(userRef);
		if (!userSnap.exists()) throw new Error('User not found');
		if (userSnap.data().balance < amount) throw new Error('Insufficient BT');

		const marketRef = doc(db, 'markets', marketId);
		const marketSnap = await tx.get(marketRef);
		if (!marketSnap.exists()) throw Error('Market not found');
		if (marketSnap.data().status !== 'open') throw Error('Market is closed');

		tx.update(userRef, { balance: increment(-amount) });
		tx.update(marketRef, {
			totalPot: increment(amount),
			[`pools.${optionId}`]: increment(amount),
		});

		tx.set(doc(collection(db, 'markets', marketId, 'bets')), {
			userId, optionId, amount, isHouseSeed: false, createdAt: serverTimestamp(),
		});

		tx.set(doc(collection(db, 'transactions')), {
			type: 'bet_placed', userId, amount: -amount,
			relatedId: marketId, createdAt: serverTimestamp(),
		});
	});
}

export async function proposeMarketResolution(marketId: string, outcome: string, reviewerId: string) {
	return runTransaction(db, async (tx) => {
		const marketRef = doc(db, 'markets', marketId);
		const marketSnap = await tx.get(marketRef);
		if (!marketSnap.exists()) throw new Error('Market not found');
		const market = marketSnap.data();
		if (market.status !== 'open') throw new Error('Already resolved or pending');

		tx.update(marketRef, {
			status: 'pending_resolution',
			proposedOutcome: outcome,
			reviewerId,
		});
		pushAlert(tx, reviewerId, 'global', 'Market Review', `You were selected as the impartial judge to verify a contract outcome.`);
	});
}

export async function rejectMarketResolution(marketId: string, reviewerId: string) {
	return runTransaction(db, async (tx) => {
		const marketRef = doc(db, 'markets', marketId);
		const marketSnap = await tx.get(marketRef);
		if (!marketSnap.exists()) throw new Error('Market not found');
		const market = marketSnap.data();
		if (market.status !== 'pending_resolution') throw new Error('Market not pending');
		if (market.reviewerId !== reviewerId) throw new Error('Not authorized to review');

		tx.update(marketRef, {
			status: 'open',
			proposedOutcome: null,
			reviewerId: null,
		});
		pushAlert(tx, market.creatorId, 'global', 'Resolution Rejected', `Your proposed market settlement was rejected.`);
	});
}

export async function resolveMarket(marketId: string, outcome: string, reviewerId?: string) {
	return runTransaction(db, async (tx) => {
		const marketRef = doc(db, 'markets', marketId);
		const marketSnap = await tx.get(marketRef);
		if (!marketSnap.exists()) throw new Error('Market not found');
		const market = marketSnap.data();
		if (market.status !== 'open' && market.status !== 'pending_resolution') throw new Error('Already resolved');

		const houseRef = doc(db, 'house', 'main');
		const houseSnap = await tx.get(houseRef);
		const house = houseSnap.data()!;

		const tax = Math.floor(market.totalPot * house.taxRate);
		const netPot = market.totalPot - tax;
		const pools = market.pools || {};
		const winningPool = pools[outcome] || 0;

		// Get all bets for the winning outcome
		const betsSnap = await getDocs(query(collection(db, 'markets', marketId, 'bets'), where('optionId', '==', outcome)));

		// Tax goes to house fund
		tx.update(houseRef, { fundBalance: increment(tax) });
		tx.set(doc(collection(db, 'transactions')), {
			type: 'tax', userId: 'house', amount: tax,
			relatedId: marketId, createdAt: serverTimestamp(),
		});

		// Pay each winner proportionally
		for (const betDoc of betsSnap.docs) {
			const bet = betDoc.data();
			const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * netPot) : 0;

			if (bet.isHouseSeed) {
				tx.update(houseRef, { fundBalance: increment(payout) });
				tx.set(doc(collection(db, 'transactions')), {
					type: 'house_seed_return', userId: 'house', amount: payout,
					relatedId: marketId, createdAt: serverTimestamp(),
				});
			} else {
				tx.update(doc(db, 'users', bet.userId), { balance: increment(payout) });
				tx.set(doc(collection(db, 'transactions')), {
					type: 'bet_payout', userId: bet.userId, amount: payout,
					relatedId: marketId, createdAt: serverTimestamp(),
					resolvedBy: reviewerId || null,
				});
			}
		}

		tx.update(marketRef, {
			status: 'resolved', outcome, taxCollected: tax,
			resolvedAt: serverTimestamp(),
			resolvedBy: reviewerId || null,
		});
	});
}

// ─── Perks ──────────────────────────────────────────────────────────

export async function buyPerk(perkId: string, userId: string) {
	return runTransaction(db, async (tx) => {
		const perkRef = doc(db, 'perks', perkId);
		const perkSnap = await tx.get(perkRef);
		if (!perkSnap.exists()) throw new Error('Perk not found');
		const perk = perkSnap.data();

		const userRef = doc(db, 'users', userId);
		const userSnap = await tx.get(userRef);
		if (!userSnap.exists()) throw new Error('User not found');
		if (userSnap.data().balance < perk.cost) throw new Error('Insufficient BT');

		tx.update(userRef, { balance: increment(-perk.cost) });
		tx.update(doc(db, 'house', 'main'), { fundBalance: increment(perk.cost) });

		tx.set(doc(collection(db, 'transactions')), {
			type: 'perk_purchase', userId, amount: -perk.cost,
			relatedId: perkId, createdAt: serverTimestamp(),
		});
	});
}

// ─── Real Money (Splitwise) ─────────────────────────────────────────

export async function createExpense(payerId: string, title: string, amountUSD: number, splitWithIds: string[]) {
	if (splitWithIds.length === 0) throw new Error('No roommates selected for split.');
	if (amountUSD <= 0) throw new Error('Invalid amount.');

	return runTransaction(db, async (tx) => {
		// 1. Create the master receipt
		const expenseRef = doc(collection(db, 'expenses'));
		tx.set(expenseRef, {
			title,
			payerId,
			amountUSD,
			splitWith: splitWithIds,
			createdAt: serverTimestamp(),
		});

		// 2. Generate exact debts for everyone except the payer
		const splitAmount = amountUSD / splitWithIds.length;
		for (const debtorId of splitWithIds) {
			if (debtorId === payerId) continue;
			
			const debtRef = doc(collection(db, 'debts'));
			tx.set(debtRef, {
				expenseId: expenseRef.id,
				title,
				fromId: debtorId,
				toId: payerId,
				amount: splitAmount,
				settled: false,
				createdAt: serverTimestamp(),
			});

			pushAlert(tx, debtorId, 'usd', 'Splitwise Expense Logged', `You owe a cut for: ${title}`);
		}
	});
}

export async function settleDebt(fromId: string, toId: string, amount: number) {
	// In a globally simplified graph, a settlement is just a physical cash payment 
	// from the Debtor (fromId) to the Creditor (toId). We don't try to resolve 
	// specific 1-to-1 receipts. This payment offsets the mathematical balance globally.
	const batch = writeBatch(db);
	
	const paymentRef = doc(collection(db, 'payments'));
	batch.set(paymentRef, {
		fromId, // The person who handed over physical money
		toId,   // The person who received physical money
		amount,
		createdAt: serverTimestamp(),
	});

	// Drop onto the main ledger for receipt rendering
	batch.set(doc(collection(db, 'transactions')), {
		type: 'usd_payment',
		userId: fromId,
		amount: -amount, // visually negative for the payer, but the ledger usually shows absolute or green depending on perspective. Let's log it accurately in USD.
		relatedId: toId, // Log who they paid
		createdAt: serverTimestamp(),
	});

	await batch.commit();
}

// ─── Settings ───────────────────────────────────────────────────────

export async function updateNotificationPrefs(userId: string, prefs: any) {
	return updateDoc(doc(db, 'users', userId), { notificationPrefs: prefs });
}

export async function completeSetup(userId: string) {
	return updateDoc(doc(db, 'users', userId), { setupComplete: true });
}

export async function markTutorialViewed(userId: string, pageKey: string) {
	const userRef = doc(db, 'users', userId);
	const userSnap = await getDoc(userRef);
	const viewed = userSnap.data()?.viewedTutorials || [];
	if (!viewed.includes(pageKey)) {
		return updateDoc(userRef, { viewedTutorials: [...viewed, pageKey] });
	}
}

// Internal standard alert push
export function pushAlert(tx: any, targetId: string, category: string, title: string, body: string) {
	tx.set(doc(collection(db, 'activity_feed')), {
		targetId,
		category,
		title,
		body,
		read: false,
		createdAt: serverTimestamp(),
	});
}
