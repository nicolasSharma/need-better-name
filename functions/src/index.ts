import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();

// Helper to get all FCM tokens EXCEPT the sender's
async function getHouseTokens(excludeUserId?: string) {
	const usersSnap = await admin.firestore().collection('users').get();
	const tokens: string[] = [];
	usersSnap.forEach(doc => {
		const data = doc.data();
		if (data.fcmToken && doc.id !== excludeUserId) {
			tokens.push(data.fcmToken);
		}
	});
	return tokens;
}

// 1. Notify on new market
export const notifyNewMarket = onDocumentCreated("markets/{marketId}", async (event) => {
	const market = event.data?.data();
	if (!market) return;

	const tokens = await getHouseTokens(market.creatorId);
	if (tokens.length === 0) return;

	await admin.messaging().sendEachForMulticast({
		tokens,
		notification: {
			title: "New Market Opened! 🎲",
			body: `Question: ${market.question}`,
		},
		webpush: { fcmOptions: { link: '/casino' } }
	});
});

// 2. Notify on market resolution
export const notifyMarketResolved = onDocumentUpdated("markets/{marketId}", async (event) => {
	const before = event.data?.before.data();
	const after = event.data?.after.data();
	if (!before || !after) return;
	
	// Only trigger if status changed to resolved
	if (before.status !== 'resolved' && after.status === 'resolved') {
		const tokens = await getHouseTokens();
		if (tokens.length === 0) return;

		await admin.messaging().sendEachForMulticast({
			tokens,
			notification: {
				title: "Market Finalized! ⚖️",
				body: `"${after.question}" resolved to ${after.outcome.toUpperCase()}.`,
			},
			webpush: { fcmOptions: { link: `/casino/${event.params.marketId}` } }
		});
	}
});

// 3. Notify when chore is completed
export const notifyChoreCompleted = onDocumentUpdated("chores/{choreId}", async (event) => {
	const before = event.data?.before.data();
	const after = event.data?.after.data();
	if (!before || !after) return;
	
	// Only trigger if status changed from open/claimed to completed
	if (before.status !== 'completed' && after.status === 'completed') {
		const tokens = await getHouseTokens(after.assigneeId);
		if (tokens.length === 0) return;

		// Fetch the user's name
		const userSnap = await admin.firestore().collection('users').doc(after.assigneeId).get();
		const name = userSnap.data()?.displayName || 'Someone';

		await admin.messaging().sendEachForMulticast({
			tokens,
			notification: {
				title: "Chore Completed! 🧹",
				body: `${name} finished "${after.name}" for ${after.reward} BT.`,
			},
			webpush: { fcmOptions: { link: '/chores' } }
		});
	}
});

// 4. Notify when toast is called
export const notifyToastCalled = onDocumentUpdated("house/main", async (event) => {
	const before = event.data?.before.data();
	const after = event.data?.after.data();
	if (!before || !after) return;
	
	const beforeToast = before.lastToast?.timestamp;
	const afterToast = after.lastToast?.timestamp;
	if (afterToast && (!beforeToast || !afterToast.isEqual(beforeToast))) {
		const triggeredBy = after.lastToast.triggeredBy;
		const userSnap = await admin.firestore().collection('users').doc(triggeredBy).get();
		const name = userSnap.data()?.displayName || 'Someone';

		const tokens = await getHouseTokens(triggeredBy);
		if (tokens.length === 0) return;

		await admin.messaging().sendEachForMulticast({
			tokens,
			notification: {
				title: "TIME TO DRINK! 🍻",
				body: `${name} called a toast!`,
			},
			webpush: { fcmOptions: { link: '/' } }
		});
	}
});

// 5. Scheduled: Time to gamble notification every 6 hours
export const notifyTimeToGamble = onSchedule("every 6 hours", async (event) => {
	const tokens = await getHouseTokens();
	if (tokens.length === 0) return;
	
	await admin.messaging().sendEachForMulticast({
		tokens,
		notification: {
			title: "Time to gamble! 🎲",
			body: "The casino is calling. Place your bets!",
		},
		webpush: { fcmOptions: { link: '/casino/games' } }
	});
});

// 6. Scheduled: Daily spin ready check every 6 hours
export const notifyDailySpinReady = onSchedule("every 6 hours", async (event) => {
	const usersSnap = await admin.firestore().collection('users').get();
	const now = new Date();
	
	for (const doc of usersSnap.docs) {
		const data = doc.data();
		if (!data.fcmToken) continue;
		
		const lastSpin = data.lastSpinAt?.toDate() || new Date(0);
		const hoursSinceLastSpin = (now.getTime() - lastSpin.getTime()) / (1000 * 60 * 60);
		
		if (hoursSinceLastSpin >= 24) {
			try {
				await admin.messaging().send({
					token: data.fcmToken,
					notification: {
						title: "Daily Spin Ready! 🎰",
						body: "Your daily spin is ready. Claim your free BT!",
					},
					webpush: { fcmOptions: { link: '/casino' } }
				});
			} catch (e) {
				console.error(`FCM failed for user ${doc.id}:`, e);
			}
		}
	}
});

// 7. Notify on User Ping
export const notifyUserPing = onDocumentCreated("pings/{pingId}", async (event) => {
	const ping = event.data?.data();
	if (!ping) return;

	const { targetId, senderId } = ping;
	
	const [targetSnap, senderSnap] = await Promise.all([
		admin.firestore().collection('users').doc(targetId).get(),
		admin.firestore().collection('users').doc(senderId).get()
	]);

	const targetData = targetSnap.data();
	const senderData = senderSnap.data();

	if (!targetData?.fcmToken) return;

	const senderName = senderData?.displayName || 'Someone';

	try {
		await admin.messaging().send({
			token: targetData.fcmToken,
			notification: {
				title: "🚨 POKE!",
				body: `${senderName} wants to drink.`,
			},
			webpush: { fcmOptions: { link: '/leaderboard' } },
			android: {
				priority: 'high',
				notification: {
					sound: 'default'
				}
			},
			apns: {
				payload: {
					aps: {
						sound: 'default'
					}
				}
			}
		});
	} catch (e) {
		console.error(`Ping push failed for user ${targetId}:`, e);
	}
});
