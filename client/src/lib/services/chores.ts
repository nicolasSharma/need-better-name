import { doc, updateDoc, increment, runTransaction, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { pushAlert } from './helpers';

export async function createChore(
	name: string, reward: number, creatorId: string,
	type: 'house' | 'bounty', recurring: 'none' | 'daily' | 'weekly',
	assignedTo: string[] | 'all', dueDate: string | null = null,
	priority: 'low' | 'medium' | 'high' = 'medium',
	hidden: boolean = false
) {
	return runTransaction(db, async (tx) => {
		if (type === 'bounty') {
			const userRef = doc(db, 'users', creatorId);
			const userSnap = await tx.get(userRef);
			if (!userSnap.exists() || userSnap.data().balance < reward) throw new Error('Insufficient BT to fund bounty');
			tx.update(userRef, { balance: increment(-reward) });
			tx.set(doc(collection(db, 'transactions')), {
				type: 'bounty_escrow', userId: creatorId, amount: -reward,
				description: `Escrow for bounty: ${name}`, relatedId: 'new_bounty', createdAt: serverTimestamp(),
			});
			pushAlert(tx, 'global', 'bounties', 'New Bounty Posted', `A bounty of ${reward} BT is open.`);
		}
		const choreRef = doc(collection(db, 'chores'));
		tx.set(choreRef, {
			name, reward, creatorId, type, recurring, assignedTo,
			assigneeId: null, status: 'open', completedBy: null, completedAt: null,
			photoUrl: null, dueDate, priority, createdAt: serverTimestamp(),
			hidden, challengedBy: null, challengeVotes: {}, challengeDeadline: null
		});
		return choreRef.id;
	});
}

export async function claimChore(choreId: string, userId: string) {
	return updateDoc(doc(db, 'chores', choreId), { assigneeId: userId, status: 'claimed' });
}

export async function submitChoreForReview(choreId: string, userId: string, photoUrl: string | null = null) {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		if (choreSnap.data().status !== 'claimed') throw new Error('Task not claimed');
		const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours to challenge
		tx.update(choreRef, { 
			status: 'pending_review', 
			completedBy: userId, 
			photoUrl,
			challengeVotes: {},
			challengedBy: null,
			challengeDeadline: Timestamp.fromDate(deadline)
		});
		pushAlert(tx, 'global', 'chores', 'Review Requested', `Someone completed a task and requested review.`);
	});
}

export async function challengeChore(choreId: string, challengerId: string) {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		const data = choreSnap.data();
		if (data.status !== 'pending_review') throw new Error('Task is not pending review');
		if (data.completedBy === challengerId) throw new Error('You cannot challenge your own task');

		const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours to vote
		tx.update(choreRef, {
			status: 'challenged',
			challengedBy: challengerId,
			challengeDeadline: Timestamp.fromDate(deadline),
			[`challengeVotes.${challengerId}`]: 'reject' // Challenger automatically votes reject
		});

		pushAlert(tx, 'global', 'chores', 'Task Challenged ⚔️', `Completed task "${data.name}" has been challenged!`);
	});
}

export async function voteOnChallenge(choreId: string, voterId: string, vote: 'approve' | 'reject') {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		const data = choreSnap.data();
		if (data.status !== 'challenged') throw new Error('Task is not in a challenged state');
		if (data.completedBy === voterId) throw new Error('Completer cannot vote');

		// Record the vote
		const newVotes = { ...(data.challengeVotes || {}), [voterId]: vote };
		tx.update(choreRef, { [`challengeVotes.${voterId}`]: vote });

		// Calculate majority
		// Get all users in the house to find total eligible voters (exclude completer)
		const usersSnap = await tx.get(collection(db, 'users'));
		const eligibleUsers = usersSnap.docs.filter(doc => doc.id !== data.completedBy && doc.data().displayName?.toLowerCase() !== 'admin');
		const totalEligible = eligibleUsers.length;
		
		// Count votes
		const approveCount = Object.values(newVotes).filter(v => v === 'approve').length;
		const rejectCount = Object.values(newVotes).filter(v => v === 'reject').length;
		
		// Check if we reached a majority (more than half of eligible voters)
		const majorityNeeded = Math.floor(totalEligible / 2) + 1;
		
		if (approveCount >= majorityNeeded) {
			// Approve the chore
			tx.update(choreRef, { status: 'completed', completedAt: serverTimestamp(), hidden: false });
			const workerRef = doc(db, 'users', data.completedBy);
			tx.update(workerRef, { balance: increment(data.reward) });
			if (data.type !== 'bounty') {
				tx.update(doc(db, 'house', 'main'), { fundBalance: increment(-data.reward) });
			}
			tx.set(doc(collection(db, 'transactions')), {
				type: data.type === 'bounty' ? 'bounty_reward' : 'chore_reward',
				userId: data.completedBy, amount: data.reward,
				description: `${data.type === 'bounty' ? 'Bounty' : 'Task'} completed (Dispute Won): "${data.name}"`,
				relatedId: choreId, createdAt: serverTimestamp(),
			});
			pushAlert(tx, data.completedBy, 'wallet', 'Dispute Resolved ✅', `Your task dispute was resolved in your favor! +${data.reward} BT.`);
		} else if (rejectCount >= majorityNeeded) {
			// Reject the chore and reset to claimed
			tx.update(choreRef, { 
				status: 'claimed', 
				photoUrl: null, 
				challengedBy: null, 
				challengeVotes: {}, 
				challengeDeadline: null 
			});
			pushAlert(tx, data.completedBy, 'chores', 'Dispute Lost ❌', `Your task completion was rejected by the house. Please try again.`);
		}
	});
}

export async function approveChore(choreId: string) {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		const chore = choreSnap.data();
		if (chore.status !== 'pending_review') throw new Error('Task not pending review');
		const workerId = chore.completedBy;
		const workerRef = doc(db, 'users', workerId);
		tx.update(workerRef, { balance: increment(chore.reward) });
		if (chore.type !== 'bounty') {
			tx.update(doc(db, 'house', 'main'), { fundBalance: increment(-chore.reward) });
		}
		tx.update(choreRef, { status: 'completed', completedAt: serverTimestamp(), hidden: false });
		tx.set(doc(collection(db, 'transactions')), {
			type: chore.type === 'bounty' ? 'bounty_reward' : 'chore_reward',
			userId: workerId, amount: chore.reward,
			description: `${chore.type === 'bounty' ? 'Bounty' : 'Task'} completed: "${chore.name}"`,
			relatedId: choreId, createdAt: serverTimestamp(),
		});
		pushAlert(tx, workerId, 'wallet', 'Task Approved', `Your task was approved! +${chore.reward} BT.`);
		if (chore.recurring && chore.recurring !== 'none') {
			tx.set(doc(collection(db, 'chores')), {
				name: chore.name, reward: chore.reward, creatorId: chore.creatorId,
				type: chore.type, recurring: chore.recurring, assignedTo: chore.assignedTo || 'all',
				assigneeId: null, status: 'open', completedBy: null, reviewerId: null,
				completedAt: null, photoUrl: null, dueDate: null, createdAt: serverTimestamp(),
				hidden: chore.hidden || false, challengedBy: null, challengeVotes: {}, challengeDeadline: null
			});
		}
	});
}

export async function rejectChore(choreId: string) {
	return runTransaction(db, async (tx) => {
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task not found');
		const chore = choreSnap.data();
		tx.update(choreRef, { status: 'claimed', photoUrl: null, challengedBy: null, challengeVotes: {}, challengeDeadline: null });
		pushAlert(tx, chore.completedBy, 'chores', 'Task Rejected', `Your task completion was rejected.`);
	});
}

export async function bountifyChore(choreId: string, userId: string, bountyAmount: number) {
	return runTransaction(db, async (tx) => {
		const userRef = doc(db, 'users', userId);
		const userSnap = await tx.get(userRef);
		if (userSnap.data()?.balance < bountyAmount) throw new Error('Insufficient BT');
		const choreRef = doc(db, 'chores', choreId);
		const choreSnap = await tx.get(choreRef);
		if (!choreSnap.exists()) throw new Error('Task missing');
		const chore = choreSnap.data()!;
		tx.update(userRef, { balance: increment(-bountyAmount) });
		tx.update(choreRef, {
			type: 'bounty', reward: chore.reward + bountyAmount, creatorId: userId,
			assignedTo: 'all', status: 'open', assigneeId: null,
		});
		tx.set(doc(collection(db, 'transactions')), {
			type: 'bounty_escrow', userId, amount: -bountyAmount,
			relatedId: choreId, createdAt: serverTimestamp(),
		});
		pushAlert(tx, 'global', 'bounties', 'Task Outsourced', `A roommate just outsourced a task for ${bountyAmount} BT!`);
	});
}
