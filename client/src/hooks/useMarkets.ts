import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface Market {
	id: string;
	question: string;
	creatorId: string;
	status: 'open' | 'locked' | 'resolved' | 'pending_resolution';
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

export const useMarkets = () => {
	const [markets, setMarkets] = useState<Market[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const q = query(collection(db, 'markets'), orderBy('createdAt', 'desc'));
		const unsub = onSnapshot(q, (snap) => {
			setMarkets(snap.docs.map((d) => {
				const data = d.data();
				// Migration Shim: Handle legacy Boolean yes/no pools
				const options = data.options || ['YES', 'NO'];
				const pools = data.pools || { 
					'YES': data.yesPool || 0, 
					'NO': data.noPool || 0 
				};
				return { id: d.id, ...data, options, pools } as Market;
			}));
			setLoading(false);
		});
		return unsub;
	}, []);

	return { markets, loading };
};

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
				const pools = data.pools || { 
					'YES': data.yesPool || 0, 
					'NO': data.noPool || 0 
				};
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
