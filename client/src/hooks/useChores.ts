import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface Chore {
	id: string;
	name: string;
	reward: number;
	assigneeId: string | null;
	status: 'open' | 'claimed' | 'pending_review' | 'completed';
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
}

export const useChores = () => {
	const [chores, setChores] = useState<Chore[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const q = query(collection(db, 'chores'), orderBy('createdAt', 'desc'));
		const unsub = onSnapshot(q, (snap) => {
			setChores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chore)));
			setLoading(false);
		});
		return unsub;
	}, []);

	return { chores, loading };
};
