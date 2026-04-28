import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface HouseFund {
	name: string;
	fundBalance: number;
	taxRate: number;
	seedAmount: number;
}

export const useHouseFund = () => {
	const [fund, setFund] = useState<HouseFund | null>(null);

	useEffect(() => {
		const unsub = onSnapshot(doc(db, 'house', 'main'), (snap) => {
			if (snap.exists()) setFund(snap.data() as HouseFund);
		});
		return unsub;
	}, []);

	return fund;
};
