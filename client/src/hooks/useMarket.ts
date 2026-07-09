import { useState, useEffect } from 'react';
import { doc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Market, Bet } from '@/types';

/** Subscribe to a single market + its bets subcollection */
export const useMarket = (marketId: string) => {
	const [market, setMarket] = useState<Market | null>(null);
	const [bets, setBets] = useState<Bet[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!marketId) return;
		const unsub1 = onSnapshot(doc(db, 'markets', marketId), (snap) => {
			if (snap.exists()) {
				const data = snap.data();
				const options = data.options || ['YES', 'NO'];
				const pools = data.pools || { 'YES': data.yesPool || 0, 'NO': data.noPool || 0 };
				setMarket({ id: snap.id, ...data, options, pools } as Market);
			}
			setLoading(false);
		});
		const unsub2 = onSnapshot(
			query(collection(db, 'markets', marketId, 'bets'), orderBy('createdAt', 'desc')),
			(snap) => setBets(snap.docs.map((d) => {
				const b = d.data();
				return { id: d.id, ...b, optionId: b.optionId || b.side } as Bet;
			}))
		);
		return () => { unsub1(); unsub2(); };
	}, [marketId]);

	return { market, bets, loading };
};
