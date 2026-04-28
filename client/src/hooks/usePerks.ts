import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface Perk {
	id: string;
	name: string;
	description: string;
	cost: number;
	icon: string;
}

export const usePerks = () => {
	const [perks, setPerks] = useState<Perk[]>([]);

	useEffect(() => {
		const q = query(collection(db, 'perks'), orderBy('cost', 'asc'));
		const unsub = onSnapshot(q, (snap) => {
			setPerks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Perk)));
		});
		return unsub;
	}, []);

	return perks;
};
