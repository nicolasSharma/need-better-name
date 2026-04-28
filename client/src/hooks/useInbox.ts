import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

export interface InboxEvent {
	id: string;
	targetId: string;
	category: string;
	title: string;
	body: string;
	read: boolean;
	createdAt: any;
}

export const useInbox = () => {
	const { user } = useAuth();
	const { profile } = useUser();
	const [events, setEvents] = useState<InboxEvent[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user || !profile) {
			setEvents([]);
			setLoading(false);
			return;
		}

		// Pull last 50 events globally
		const q = query(
			collection(db, 'activity_feed'),
			orderBy('createdAt', 'desc'),
			limit(50)
		);

		const unsub = onSnapshot(q, (snap) => {
			const allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() } as InboxEvent));
			
			// Filter by Target and Preferences
			const filtered = allEvents.filter(ev => {
				// Must be targeted at 'global' or 'user.uid'
				if (ev.targetId !== 'global' && ev.targetId !== user.uid) return false;

				// Check User configuration preferences
				const prefs = profile.notificationPrefs || {
					bounties: true, chores: true, markets: true, usd: true
				};

				if (ev.category === 'bounties' && !prefs.bounties) return false;
				if (ev.category === 'chores' && !prefs.chores) return false;
				if (ev.category === 'markets' && !prefs.markets) return false;
				if (ev.category === 'usd' && !prefs.usd) return false;

				return true;
			});

			setEvents(filtered);
			setLoading(false);
		});

		return unsub;
	}, [user, profile?.notificationPrefs]);

	return { events, loading, unreadCount: events.filter(e => !e.read).length };
};
