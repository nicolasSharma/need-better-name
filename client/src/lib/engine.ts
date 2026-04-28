import { doc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '@/config/firebase';

/** Initialize the core fund with sensible defaults */
export async function initHubFund() {
	await setDoc(doc(db, 'house', 'main'), {
		name: 'THE HUB',
		fundBalance: 10000,
		taxRate: 0.03,
		seedAmount: 50,
		createdAt: serverTimestamp(),
	});
}

/** Seed some starter perks */
export async function seedPerks() {
	const perks = [
		{ name: 'Skip Pass', description: 'Skip your next chore assignment', cost: 150, icon: '' },
		{ name: 'Aux Rights', description: 'Control the house speaker for the evening', cost: 100, icon: '' },
		{ name: 'Couch priority', description: 'Priority for common space seating', cost: 75, icon: '' },
		{ name: 'Fridge Shelf', description: 'Reserved refrigerator shelf for 7 days', cost: 200, icon: '' },
		{ name: 'Shower priority', description: 'First dibs on the shower for 7 days', cost: 125, icon: '' },
		{ name: 'Executive Veto', description: 'Veto one house decision', cost: 300, icon: '' },
	];
	for (const perk of perks) {
		await addDoc(collection(db, 'perks'), perk);
	}
}

/** 
 * Calculate live payouts for N options.
 * @param totalPot The total BT in the market
 * @param pools Key-value of optionId -> total BT in that option's pool
 * @param taxRate The percentage taken by the house (0.03 = 3%)
 */
export function calcPayouts(totalPot: number, pools: Record<string, number>, taxRate: number) {
	const netPot = totalPot * (1 - taxRate);
	const payouts: Record<string, number> = {};
	
	Object.keys(pools).forEach(optionId => {
		const pool = pools[optionId];
		payouts[optionId] = pool > 0 ? parseFloat((netPot / pool).toFixed(2)) : 0;
	});
	
	return payouts;
}
