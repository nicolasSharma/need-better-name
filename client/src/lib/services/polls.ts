import { collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '@/config/firebase';

/** Create a new house poll */
export async function createPoll(
	creatorId: string,
	question: string,
	options: string[],
) {
	const pollData: any = {
		question,
		options,
		votes: {} as Record<string, string[]>, // optionIndex -> userId[]
		creatorId,
		status: 'open',
		createdAt: serverTimestamp(),
	};
	// Initialize empty vote arrays for each option
	options.forEach((_, i) => { pollData.votes[i.toString()] = []; });

	const ref = await addDoc(collection(db, 'polls'), pollData);
	return ref.id;
}

/** Cast a vote (or change it) */
export async function votePoll(pollId: string, userId: string, optionIndex: number) {
	const pollRef = doc(db, 'polls', pollId);

	await runTransaction(db, async (tx) => {
		const snap = await tx.get(pollRef);
		if (!snap.exists()) throw new Error('Poll not found');
		const data = snap.data();
		if (data.status !== 'open') throw new Error('Poll is closed');

		const votes = { ...data.votes };

		// Remove user from any previous vote
		Object.keys(votes).forEach(key => {
			votes[key] = (votes[key] || []).filter((id: string) => id !== userId);
		});

		// Add to new option
		const key = optionIndex.toString();
		votes[key] = [...(votes[key] || []), userId];

		tx.update(pollRef, { votes });
	});
}

/** Close a poll */
export async function closePoll(pollId: string) {
	await updateDoc(doc(db, 'polls', pollId), { status: 'closed' });
}
