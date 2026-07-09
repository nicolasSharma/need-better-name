"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUserPing = exports.notifyDailySpinReady = exports.notifyTimeToGamble = exports.notifyToastCalled = exports.notifyChoreCompleted = exports.notifyMarketResolved = exports.notifyNewMarket = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();
// Helper to get all FCM tokens EXCEPT the sender's
async function getHouseTokens(excludeUserId) {
    const usersSnap = await admin.firestore().collection('users').get();
    const tokens = [];
    usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.fcmToken && doc.id !== excludeUserId) {
            tokens.push(data.fcmToken);
        }
    });
    return tokens;
}
// 1. Notify on new market
exports.notifyNewMarket = (0, firestore_1.onDocumentCreated)("markets/{marketId}", async (event) => {
    var _a;
    const market = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!market)
        return;
    const tokens = await getHouseTokens(market.creatorId);
    if (tokens.length === 0)
        return;
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
exports.notifyMarketResolved = (0, firestore_1.onDocumentUpdated)("markets/{marketId}", async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Only trigger if status changed to resolved
    if (before.status !== 'resolved' && after.status === 'resolved') {
        const tokens = await getHouseTokens();
        if (tokens.length === 0)
            return;
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
exports.notifyChoreCompleted = (0, firestore_1.onDocumentUpdated)("chores/{choreId}", async (event) => {
    var _a, _b, _c;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Only trigger if status changed from open/claimed to completed
    if (before.status !== 'completed' && after.status === 'completed') {
        const tokens = await getHouseTokens(after.assigneeId);
        if (tokens.length === 0)
            return;
        // Fetch the user's name
        const userSnap = await admin.firestore().collection('users').doc(after.assigneeId).get();
        const name = ((_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.displayName) || 'Someone';
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
exports.notifyToastCalled = (0, firestore_1.onDocumentUpdated)("house/main", async (event) => {
    var _a, _b, _c, _d, _e;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    const beforeToast = (_c = before.lastToast) === null || _c === void 0 ? void 0 : _c.timestamp;
    const afterToast = (_d = after.lastToast) === null || _d === void 0 ? void 0 : _d.timestamp;
    if (afterToast && (!beforeToast || !afterToast.isEqual(beforeToast))) {
        const triggeredBy = after.lastToast.triggeredBy;
        const userSnap = await admin.firestore().collection('users').doc(triggeredBy).get();
        const name = ((_e = userSnap.data()) === null || _e === void 0 ? void 0 : _e.displayName) || 'Someone';
        const tokens = await getHouseTokens(triggeredBy);
        if (tokens.length === 0)
            return;
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
exports.notifyTimeToGamble = (0, scheduler_1.onSchedule)("every 6 hours", async (event) => {
    const tokens = await getHouseTokens();
    if (tokens.length === 0)
        return;
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
exports.notifyDailySpinReady = (0, scheduler_1.onSchedule)("every 6 hours", async (event) => {
    var _a;
    const usersSnap = await admin.firestore().collection('users').get();
    const now = new Date();
    for (const doc of usersSnap.docs) {
        const data = doc.data();
        if (!data.fcmToken)
            continue;
        const lastSpin = ((_a = data.lastSpinAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(0);
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
            }
            catch (e) {
                console.error(`FCM failed for user ${doc.id}:`, e);
            }
        }
    }
});
// 7. Notify on User Ping
exports.notifyUserPing = (0, firestore_1.onDocumentCreated)("pings/{pingId}", async (event) => {
    var _a;
    const ping = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!ping)
        return;
    const { targetId, senderId } = ping;
    const [targetSnap, senderSnap] = await Promise.all([
        admin.firestore().collection('users').doc(targetId).get(),
        admin.firestore().collection('users').doc(senderId).get()
    ]);
    const targetData = targetSnap.data();
    const senderData = senderSnap.data();
    if (!(targetData === null || targetData === void 0 ? void 0 : targetData.fcmToken))
        return;
    const senderName = (senderData === null || senderData === void 0 ? void 0 : senderData.displayName) || 'Someone';
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
    }
    catch (e) {
        console.error(`Ping push failed for user ${targetId}:`, e);
    }
});
//# sourceMappingURL=index.js.map