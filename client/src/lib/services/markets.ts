import { doc, updateDoc, increment, runTransaction, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { pushAlert } from './helpers';

export async function createMarket(
	question: string, creatorId: string, betAmount: number, selectedOptionId: string,
	options: string[], taggedUserId: string | null = null, expiresAt: Date | null = null
) {
	return runTransaction(db, async (tx) => {
		const userRef = doc(db, 'users', creatorId);
		const userSnap = await tx.get(userRef);
		if (!userSnap.exists()) throw new Error('User not found');
		if (userSnap.data()!.balance < betAmount) throw new Error('Insufficient BT');
		const houseRef = doc(db, 'house', 'main');
		const houseSnap = await tx.get(houseRef);
		const house = houseSnap.data()!;
		const seedPerOption = house.seedAmount || 50;
		const totalSeed = seedPerOption * (options.length - 1);
		tx.update(userRef, { balance: increment(-betAmount) });
		tx.update(houseRef, { fundBalance: increment(-totalSeed) });
		const pools: Record<string, number> = {};
		options.forEach(opt => { pools[opt] = (opt === selectedOptionId) ? betAmount : seedPerOption; });
		const marketRef = doc(collection(db, 'markets'));
		tx.set(marketRef, {
			question, creatorId, status: 'open', outcome: null,
			totalPot: betAmount + totalSeed, options, pools, taxCollected: 0,
			taggedUserId, expiresAt: expiresAt || null, challengeDeadline: null,
			createdAt: serverTimestamp(), resolvedAt: null,
		});
		tx.set(doc(collection(db, 'markets', marketRef.id, 'bets')), {
			userId: creatorId, optionId: selectedOptionId, amount: betAmount,
			isHouseSeed: false, createdAt: serverTimestamp(),
		});
		tx.set(doc(collection(db, 'transactions')), {
			type: 'bet_placed', userId: creatorId, amount: -betAmount,
			description: `Opened contract: "${question}" (Pick: ${selectedOptionId})`,
			relatedId: marketRef.id, createdAt: serverTimestamp(),
		});
		options.filter(opt => opt !== selectedOptionId).forEach(opt => {
			tx.set(doc(collection(db, 'markets', marketRef.id, 'bets')), {
				userId: 'house', optionId: opt, amount: seedPerOption,
				isHouseSeed: true, createdAt: serverTimestamp(),
			});
		});
		tx.set(doc(collection(db, 'transactions')), {
			type: 'house_seed', userId: 'house', amount: -totalSeed,
			description: `House liquidity seed for: "${question}"`,
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
		tx.update(marketRef, { totalPot: increment(amount), [`pools.${optionId}`]: increment(amount) });
		tx.set(doc(collection(db, 'markets', marketId, 'bets')), {
			userId, optionId, amount, isHouseSeed: false, createdAt: serverTimestamp(),
		});
		tx.set(doc(collection(db, 'transactions')), {
			type: 'bet_placed', userId, amount: -amount,
			description: `Bet on "${marketSnap.data().question}" (Pick: ${optionId})`,
			relatedId: marketId, createdAt: serverTimestamp(),
		});
	});
}

export async function proposeMarketResolution(marketId: string, outcome: string, reviewerId: string) {
	return runTransaction(db, async (tx) => {
		const marketRef = doc(db, 'markets', marketId);
		const marketSnap = await tx.get(marketRef);
		if (!marketSnap.exists()) throw new Error('Market not found');
		if (marketSnap.data().status !== 'open') throw new Error('Already resolved or pending');
		tx.update(marketRef, { status: 'pending_resolution', proposedOutcome: outcome, reviewerId });
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
		tx.update(marketRef, { status: 'open', proposedOutcome: null, reviewerId: null });
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
		const betsSnap = await getDocs(query(collection(db, 'markets', marketId, 'bets'), where('optionId', '==', outcome)));
		tx.update(houseRef, { fundBalance: increment(tax) });
		tx.set(doc(collection(db, 'transactions')), {
			type: 'tax', userId: 'house', amount: tax, relatedId: marketId, createdAt: serverTimestamp(),
		});
		for (const betDoc of betsSnap.docs) {
			const bet = betDoc.data();
			const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * netPot) : 0;
			if (bet.isHouseSeed) {
				tx.update(houseRef, { fundBalance: increment(payout) });
				tx.set(doc(collection(db, 'transactions')), {
					type: 'house_seed_return', userId: 'house', amount: payout, relatedId: marketId, createdAt: serverTimestamp(),
				});
			} else {
				tx.update(doc(db, 'users', bet.userId), { balance: increment(payout) });
				tx.set(doc(collection(db, 'transactions')), {
					type: 'bet_payout', userId: bet.userId, amount: payout,
					description: `Won ${payout} BT on "${market.question}" (${outcome})`,
					relatedId: marketId, createdAt: serverTimestamp(), resolvedBy: reviewerId || null,
				});
			}
		}
		tx.update(marketRef, {
			status: 'resolved', outcome, taxCollected: tax,
			resolvedAt: serverTimestamp(), resolvedBy: reviewerId || null,
			challengeDeadline: reviewerId ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
		});
	});
}

export async function challengeResolution(marketId: string, challengerId: string) {
	return runTransaction(db, async (tx) => {
		const marketRef = doc(db, 'markets', marketId);
		const marketSnap = await tx.get(marketRef);
		if (!marketSnap.exists()) throw new Error('Market not found');
		const market = marketSnap.data();
		if (market.status !== 'resolved') throw new Error('Market not in resolved state');
		if (market.challengeDeadline && new Date() > market.challengeDeadline.toDate()) throw new Error('Challenge window has closed');
		if (challengerId === market.resolvedBy || challengerId === market.creatorId) throw new Error('Creator cannot challenge their own resolution');
		const houseRef = doc(db, 'house', 'main');
		const tax = market.taxCollected || 0;
		const netPot = market.totalPot - tax;
		const pools = market.pools || {};
		const winningPool = pools[market.outcome] || 0;
		tx.update(houseRef, { fundBalance: increment(-tax) });
		const betsSnap = await getDocs(query(collection(db, 'markets', marketId, 'bets'), where('optionId', '==', market.outcome)));
		for (const betDoc of betsSnap.docs) {
			const bet = betDoc.data();
			const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * netPot) : 0;
			if (bet.isHouseSeed) {
				tx.update(houseRef, { fundBalance: increment(-payout) });
			} else {
				const userRef = doc(db, 'users', bet.userId);
				const userSnap = await tx.get(userRef);
				if (userSnap.exists()) {
					const currentBalance = userSnap.data().balance || 0;
					const deductAmount = Math.min(payout, currentBalance);
					tx.update(userRef, { balance: increment(-deductAmount) });
				}
			}
		}
		const usersSnap = await getDocs(collection(db, 'users'));
		const allBetsSnap = await getDocs(collection(db, 'markets', marketId, 'bets'));
		const bettorIds = new Set(allBetsSnap.docs.map(d => d.data().userId));
		const candidates = usersSnap.docs
			.filter(d => !bettorIds.has(d.id) && d.id !== challengerId && d.id !== market.creatorId && d.data().displayName?.toLowerCase() !== 'admin')
			.map(d => d.id);
		const reviewerId = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : challengerId;
		tx.update(marketRef, { status: 'disputed', challengeDeadline: null, reviewerId, taxCollected: 0 });
		pushAlert(tx, reviewerId, 'global', 'Dispute Filed', `A market resolution was challenged. You have been selected as the impartial judge.`);
		pushAlert(tx, market.creatorId, 'markets', 'Resolution Challenged', `Your resolution of "${market.question}" has been disputed.`);
	});
}

export async function resolveDispute(marketId: string, outcome: string, reviewerId: string) {
	return runTransaction(db, async (tx) => {
		const marketRef = doc(db, 'markets', marketId);
		const marketSnap = await tx.get(marketRef);
		if (!marketSnap.exists()) throw new Error('Market not found');
		const market = marketSnap.data();
		if (market.status !== 'disputed') throw new Error('Market not disputed');
		if (market.reviewerId !== reviewerId) throw new Error('Not authorized');
		const houseRef = doc(db, 'house', 'main');
		const houseSnap = await tx.get(houseRef);
		const house = houseSnap.data()!;
		const tax = Math.floor(market.totalPot * house.taxRate);
		const netPot = market.totalPot - tax;
		const pools = market.pools || {};
		const winningPool = pools[outcome] || 0;
		tx.update(houseRef, { fundBalance: increment(tax) });
		const betsSnap = await getDocs(query(collection(db, 'markets', marketId, 'bets'), where('optionId', '==', outcome)));
		for (const betDoc of betsSnap.docs) {
			const bet = betDoc.data();
			const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * netPot) : 0;
			if (bet.isHouseSeed) {
				tx.update(houseRef, { fundBalance: increment(payout) });
			} else {
				tx.update(doc(db, 'users', bet.userId), { balance: increment(payout) });
				tx.set(doc(collection(db, 'transactions')), {
					type: 'bet_payout', userId: bet.userId, amount: payout,
					description: `Won ${payout} BT on "${market.question}" (${outcome}) [Dispute resolved]`,
					relatedId: marketId, createdAt: serverTimestamp(), resolvedBy: reviewerId,
				});
			}
		}
		tx.update(marketRef, {
			status: 'resolved', outcome, taxCollected: tax,
			resolvedAt: serverTimestamp(), resolvedBy: reviewerId, challengeDeadline: null,
		});
		pushAlert(tx, 'global', 'markets', 'Dispute Resolved', `"${market.question}" was resolved as: ${outcome}`);
	});
}
