import { doc, runTransaction, increment, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function playCasinoGame(
	userId: string, betAmount: number, payout: number,
	gameType: 'blackjack' | 'roulette' | 'streak' | 'craps' | 'race' | 'mines' | 'crash',
	detail: string
) {
	await runTransaction(db, async (tx) => {
		const userRef = doc(db, 'users', userId);
		const userSnap = await tx.get(userRef);
		if (!userSnap.exists()) throw new Error('User not found');
		const userData = userSnap.data();
		if (userData.balance < betAmount) throw new Error('Insufficient balance');
		const houseRef = doc(db, 'house', 'main');
		const netChange = payout - betAmount;
		tx.update(userRef, { balance: increment(netChange) });
		tx.update(houseRef, { fundBalance: increment(-netChange) });
		tx.set(doc(collection(db, 'transactions')), {
			type: `gamble_${gameType}`, userId, amount: netChange,
			description: detail, relatedId: `house_${gameType}`, createdAt: serverTimestamp(),
		});
	});
}

export async function claimDailySpin(userId: string, rewardAmount: number) {
	const res = await runTransaction(db, async (tx) => {
		const userRef = doc(db, 'users', userId);
		const userSnap = await tx.get(userRef);
		if (!userSnap.exists()) throw new Error('User not found');
		
		const data = userSnap.data();
		const now = new Date();
		const lastSpin = data.lastSpinAt?.toDate() || new Date(0);
		const hoursSinceLastSpin = (now.getTime() - lastSpin.getTime()) / (1000 * 60 * 60);
		
		if (hoursSinceLastSpin < 24) {
			throw new Error('You must wait 24 hours between spins.');
		}

		let spinStreak = data.spinStreak || 0;
		if (hoursSinceLastSpin > 48) {
			spinStreak = 1; // reset streak if missed a day
		} else {
			spinStreak += 1;
		}

		tx.update(userRef, { 
			balance: increment(rewardAmount),
			lastSpinAt: serverTimestamp(),
			spinStreak
		});

		tx.update(doc(db, 'house', 'main'), { fundBalance: increment(-rewardAmount) });

		tx.set(doc(collection(db, 'transactions')), {
			type: 'daily_spin', userId, amount: rewardAmount,
			description: `Daily Spin Reward (Streak: ${spinStreak} 🔥)`, relatedId: 'daily_spin', createdAt: serverTimestamp(),
		});

		return spinStreak;
	});
	return res;
}
