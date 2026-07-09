import { useState, useEffect, useMemo } from 'react';
import { Box, Flex, Text, VStack, HStack, Heading, Avatar, Badge, Icon, Button, SimpleGrid, Divider } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthProvider';
import { useRoommates } from '@/context/AppDataProvider';
import { IoArrowBack, IoTrophyOutline, IoDiceOutline, IoCheckmarkCircleOutline, IoStatsChartOutline, IoFlameOutline, IoFishOutline, IoHammerOutline, IoRibbonOutline, IoStarOutline, IoCalendarOutline, IoTrendingUpOutline } from 'react-icons/io5';
import Skeleton from '@/components/Skeleton';

interface UserStats {
	totalEarnedChores: number;
	totalGambled: number;
	totalWon: number;
	choresCompleted: number;
	marketsCreated: number;
	gamesPlayed: number;
	biggestWin: number;
	biggestBet: number;
}

interface Achievement {
	id: string;
	name: string;
	desc: string;
	icon: any;
	color: string;
	earned: boolean;
}

// ─── Mini Sparkline (pure SVG) ──────────────────────────────────────
const BalanceSparkline = ({ transactions }: { transactions: any[] }) => {
	const points = useMemo(() => {
		if (!transactions.length) return [];
		// Build running balance from oldest→newest
		const sorted = [...transactions].reverse();
		let running = 0;
		return sorted.map(tx => { running += tx.amount; return running; });
	}, [transactions]);

	if (points.length < 2) return null;

	const min = Math.min(...points);
	const max = Math.max(...points);
	const range = max - min || 1;
	const w = 280, h = 60, pad = 4;

	const pathData = points.map((v, i) => {
		const x = pad + (i / (points.length - 1)) * (w - pad * 2);
		const y = pad + (1 - (v - min) / range) * (h - pad * 2);
		return `${i === 0 ? 'M' : 'L'}${x},${y}`;
	}).join(' ');

	const lastVal = points[points.length - 1];
	const isUp = lastVal >= points[0];

	return (
		<Box mb={6}>
			<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest' mb={2}>BALANCE TREND</Text>
			<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={4} overflow='hidden'>
				<svg viewBox={`0 0 ${w} ${h}`} width='100%' height={h} style={{ display: 'block' }}>
					<defs>
						<linearGradient id='sparkGrad' x1='0' y1='0' x2='0' y2='1'>
							<stop offset='0%' stopColor={isUp ? '#34C759' : '#FF3B30'} stopOpacity='0.3' />
							<stop offset='100%' stopColor={isUp ? '#34C759' : '#FF3B30'} stopOpacity='0' />
						</linearGradient>
					</defs>
					<path d={`${pathData} L${w - pad},${h - pad} L${pad},${h - pad} Z`} fill='url(#sparkGrad)' />
					<path d={pathData} fill='none' stroke={isUp ? '#34C759' : '#FF3B30'} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
				</svg>
			</Box>
		</Box>
	);
};

// ─── Activity Heatmap (30 days) ─────────────────────────────────────
const ActivityHeatmap = ({ transactions }: { transactions: any[] }) => {
	const days = useMemo(() => {
		const now = new Date();
		const grid: { date: string; count: number; dayLabel: string }[] = [];
		for (let i = 29; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			const key = d.toISOString().split('T')[0];
			const count = transactions.filter(tx => {
				const txDate = tx.createdAt?.toDate?.();
				if (!txDate) return false;
				return txDate.toISOString().split('T')[0] === key;
			}).length;
			grid.push({ date: key, count, dayLabel: d.getDate().toString() });
		}
		return grid;
	}, [transactions]);

	const maxCount = Math.max(...days.map(d => d.count), 1);

	return (
		<Box mb={6}>
			<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest' mb={2}>30-DAY ACTIVITY</Text>
			<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={4} overflowX='auto'>
				<Flex gap='3px' flexWrap='wrap'>
					{days.map(day => {
						const intensity = day.count / maxCount;
						const bg = day.count === 0
							? 'surfaceDeep'
							: intensity > 0.7 ? 'primaryAction' : intensity > 0.3 ? 'rgba(10,132,255,0.5)' : 'rgba(10,132,255,0.2)';
						return (
							<Box
								key={day.date}
								w='calc((100% - 87px) / 30)'
								minW='14px'
								h='14px'
								bg={bg}
								borderRadius='3px'
								title={`${day.date}: ${day.count} actions`}
								transition='transform 0.15s'
								_hover={{ transform: 'scale(1.4)' }}
							/>
						);
					})}
				</Flex>
				<Flex justify='space-between' mt={2}>
					<Text fontSize='8px' color='textSecondary'>30d ago</Text>
					<Text fontSize='8px' color='textSecondary'>Today</Text>
				</Flex>
			</Box>
		</Box>
	);
};

// ─── Win/Loss Ratio Bar ─────────────────────────────────────────────
const WinLossBar = ({ won, lost }: { won: number; lost: number }) => {
	const total = won + lost;
	if (total === 0) return null;
	const winPct = (won / total) * 100;

	return (
		<Box mb={6}>
			<Flex justify='space-between' mb={1}>
				<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest'>WIN / LOSS RATIO</Text>
				<Text fontSize='10px' fontWeight='800' color='textSecondary'>{winPct.toFixed(0)}% W</Text>
			</Flex>
			<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={3}>
				<Flex h='12px' borderRadius='full' overflow='hidden' bg='surfaceDeep'>
					<Box bg='yesAction' w={`${winPct}%`} borderRadius='full' transition='width 0.5s ease' />
					<Box bg='noAction' w={`${100 - winPct}%`} transition='width 0.5s ease' />
				</Flex>
				<Flex justify='space-between' mt={2}>
					<Text fontSize='xs' fontWeight='800' color='yesAction'>{won} BT won</Text>
					<Text fontSize='xs' fontWeight='800' color='noAction'>{lost} BT lost</Text>
				</Flex>
			</Box>
		</Box>
	);
};

// ─── Main Component ─────────────────────────────────────────────────
const ProfilePage = () => {
	const { userId } = useParams<{ userId: string }>();
	const { user } = useAuth();
	const navigate = useNavigate();
	const targetId = userId || user?.uid;

	const { roommates: allRoommates } = useRoommates();
	const [profile, setProfile] = useState<any>(null);
	const [stats, setStats] = useState<UserStats | null>(null);
	const [nemesis, setNemesis] = useState<{ id: string | null, clashes: number }>({ id: null, clashes: 0 });
	const [allTx, setAllTx] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	// Compute rank from shared roommate list
	const rank = useMemo(() => {
		const sorted = [...allRoommates].sort((a, b) => b.balance - a.balance);
		return sorted.findIndex(r => r.id === targetId) + 1;
	}, [allRoommates, targetId]);

	useEffect(() => {
		if (!targetId) return;

		// Listen to user profile
		const unsub = onSnapshot(doc(db, 'users', targetId), snap => {
			if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
		});

		// Compute stats from transactions
		const computeStats = async () => {
			const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', targetId)));
			const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

			let totalEarnedChores = 0, totalGambled = 0, totalWon = 0, gamesPlayed = 0, biggestWin = 0, biggestBet = 0;

			txs.forEach(tx => {
				if (tx.type === 'chore_reward' || tx.type === 'bounty_reward') totalEarnedChores += tx.amount;
				if (tx.type?.startsWith('gamble_')) {
					gamesPlayed++;
					if (tx.amount > 0) totalWon += tx.amount;
					if (tx.amount < 0) totalGambled += Math.abs(tx.amount);
					if (tx.amount > biggestWin) biggestWin = tx.amount;
				}
				if (tx.type === 'bet_placed') {
					const betAmt = Math.abs(tx.amount);
					totalGambled += betAmt;
					if (betAmt > biggestBet) biggestBet = betAmt;
				}
				if (tx.type === 'bet_payout' && tx.amount > biggestWin) biggestWin = tx.amount;
			});

			// Chores completed
			const choreSnap = await getDocs(query(collection(db, 'chores'), where('completedBy', '==', targetId), where('status', '==', 'completed')));
			const choresCompleted = choreSnap.size;

			// Markets created
			const marketSnap = await getDocs(query(collection(db, 'markets'), where('creatorId', '==', targetId)));
			const marketsCreated = marketSnap.size;

			// Sort by time for sparkline
			const sorted = txs.sort((a: any, b: any) => {
				const tA = a.createdAt?.toMillis?.() || 0;
				const tB = b.createdAt?.toMillis?.() || 0;
				return tB - tA;
			});
			setAllTx(sorted);

			// Nemesis logic
			const myMarketIds = txs.filter((t: any) => t.type === 'bet_placed').map((t: any) => t.relatedId);
			let nId = null;
			let nClashes = 0;
			if (myMarketIds.length > 0) {
				const allBetsSnap = await getDocs(query(collection(db, 'transactions'), where('type', '==', 'bet_placed')));
				const clashes: Record<string, number> = {};
				allBetsSnap.docs.forEach(d => {
					const t = d.data();
					if (t.userId !== targetId && myMarketIds.includes(t.relatedId)) {
						clashes[t.userId] = (clashes[t.userId] || 0) + 1;
					}
				});
				for (const [uid, count] of Object.entries(clashes)) {
					if (count > nClashes) { nClashes = count; nId = uid; }
				}
			}
			setNemesis({ id: nId, clashes: nClashes });

			setStats({ totalEarnedChores, totalGambled, totalWon, choresCompleted, marketsCreated, gamesPlayed, biggestWin, biggestBet });
			setLoading(false);
		};

		computeStats();
		return unsub;
	}, [targetId]);

	if (loading || !profile) {
		return (
			<Box p={8} maxW='600px' mx='auto'>
				<Skeleton h='200px' borderRadius='24px' mb={6} />
				<Skeleton h='100px' borderRadius='16px' mb={4} />
				<Skeleton h='100px' borderRadius='16px' />
			</Box>
		);
	}

	const achievements: Achievement[] = [
		{ id: 'whale', name: 'Whale', desc: 'Bet 1000+ BT in a single market', icon: IoFishOutline, color: 'blue.400', earned: (stats?.biggestBet || 0) >= 1000 },
		{ id: 'workhorse', name: 'Workhorse', desc: 'Completed 10+ chores', icon: IoHammerOutline, color: 'orange.400', earned: (stats?.choresCompleted || 0) >= 10 },
		{ id: 'high_roller', name: 'High Roller', desc: 'Gambled 5000+ total BT', icon: IoDiceOutline, color: 'purple.400', earned: (stats?.totalGambled || 0) >= 5000 },
		{ id: 'market_maker', name: 'Market Maker', desc: 'Created 5+ markets', icon: IoStatsChartOutline, color: 'green.400', earned: (stats?.marketsCreated || 0) >= 5 },
		{ id: 'big_win', name: 'Jackpot', desc: 'Won 500+ BT in a single payout', icon: IoStarOutline, color: 'yellow.400', earned: (stats?.biggestWin || 0) >= 500 },
		{ id: 'veteran', name: 'Veteran', desc: 'Played 50+ casino games', icon: IoRibbonOutline, color: 'red.400', earned: (stats?.gamesPlayed || 0) >= 50 },
	];

	const earnedCount = achievements.filter(a => a.earned).length;
	const isMe = targetId === user?.uid;

	const memberSince = profile.createdAt?.toDate?.()
		? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(profile.createdAt.toDate())
		: null;

	return (
		<Box p={6} pb={24} maxW='600px' mx='auto'>
			<Button leftIcon={<IoArrowBack />} variant='ghost' size='sm' onClick={() => navigate(-1)} mb={6} color='textSecondary' px={0}>
				Back
			</Button>

			{/* Profile Header */}
			<Box as={motion.div} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
				<Flex align='center' gap={5} mb={2}>
					<Avatar size='2xl' name={profile.displayName} bg={profile.color} color='white' border='3px solid' borderColor='primaryAction' />
					<Box>
						<Heading size='xl' fontWeight='900' color='textPrimary'>{profile.displayName}</Heading>
						<HStack spacing={3} mt={1}>
							<Badge colorScheme='yellow' borderRadius='full' px={3} py={1} fontSize='sm' fontWeight='900'>
								#{rank}
							</Badge>
							<Text fontSize='2xl' fontWeight='900' color='primaryAction' fontFamily='JetBrains Mono'>
								{profile.balance} BT
							</Text>
						</HStack>
						{isMe && <Text fontSize='xs' color='textSecondary' mt={1}>{profile.email}</Text>}
					</Box>
				</Flex>
				{memberSince && (
					<HStack spacing={1} mb={6} ml={1}>
						<Icon as={IoCalendarOutline} color='textSecondary' boxSize={3} />
						<Text fontSize='11px' color='textSecondary' fontWeight='600'>Member since {memberSince}</Text>
					</HStack>
				)}
			</Box>

			{/* Balance Sparkline */}
			<BalanceSparkline transactions={allTx} />

			{/* Win/Loss Ratio */}
			<WinLossBar won={stats?.totalWon || 0} lost={stats?.totalGambled || 0} />

			{/* Activity Heatmap */}
			<ActivityHeatmap transactions={allTx} />

			{/* Stats Grid */}
			<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest' mb={3}>STATISTICS</Text>
			<SimpleGrid columns={2} spacing={3} mb={8}>
				{[
					{ label: 'Chores Done', value: stats?.choresCompleted || 0, color: 'yesAction' },
					{ label: 'BT from Chores', value: stats?.totalEarnedChores || 0, color: 'yesAction' },
					{ label: 'Total Gambled', value: stats?.totalGambled || 0, color: 'noAction' },
					{ label: 'Total Won', value: stats?.totalWon || 0, color: 'primaryAction' },
					{ label: 'Games Played', value: stats?.gamesPlayed || 0, color: 'textPrimary' },
					{ label: 'Markets Created', value: stats?.marketsCreated || 0, color: 'textPrimary' },
				].map((s, i) => (
					<Box key={i} bg='surface' p={4} borderRadius='16px' border='1px solid' borderColor='border'>
						<Text fontSize='10px' fontWeight='800' color='textSecondary' letterSpacing='wider' mb={1}>{s.label.toUpperCase()}</Text>
						<Text fontSize='xl' fontWeight='900' color={s.color} fontFamily='JetBrains Mono'>{s.value}</Text>
					</Box>
				))}
			</SimpleGrid>

			{/* Nemesis */}
			{nemesis.id && nemesis.clashes > 0 && (() => {
				const rival = allRoommates.find(r => r.id === nemesis.id);
				if (!rival) return null;
				return (
					<Box mb={8}>
						<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest' mb={3}>PLAYER RIVALRIES</Text>
						<Box bg='surfaceDeep' p={4} borderRadius='16px' border='1px solid' borderColor='border' position='relative' overflow='hidden'>
							<Box position='absolute' top='-10px' right='-10px' opacity={0.05}>
								<Icon as={IoTrophyOutline} boxSize={24} color='red.500' />
							</Box>
							<HStack spacing={4}>
								<Avatar size='md' name={rival.displayName} bg={rival.color} color='white' border='2px solid' borderColor='red.400' />
								<Box>
									<Text fontSize='xs' fontWeight='800' color='red.400' textTransform='uppercase' letterSpacing='wider'>NEMESIS</Text>
									<Text fontSize='lg' fontWeight='800' color='textPrimary'>{rival.displayName}</Text>
									<Text fontSize='xs' color='textSecondary'>Clashed in {nemesis.clashes} markets</Text>
								</Box>
							</HStack>
						</Box>
					</Box>
				);
			})()}

			{/* Achievements */}
			<Flex justify='space-between' align='center' mb={3}>
				<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest'>ACHIEVEMENTS</Text>
				<Badge borderRadius='full' colorScheme='yellow' px={2}>{earnedCount}/{achievements.length}</Badge>
			</Flex>
			<SimpleGrid columns={2} spacing={3} mb={8}>
				{achievements.map(a => (
					<Box
						key={a.id}
						bg={a.earned ? 'surface' : 'surfaceDeep'}
						p={4}
						borderRadius='16px'
						border='1px solid'
						borderColor={a.earned ? a.color : 'border'}
						opacity={a.earned ? 1 : 0.4}
						transition='all 0.3s'
					>
						<HStack spacing={3}>
							<Flex w='40px' h='40px' borderRadius='12px' bg={a.earned ? `${a.color}20` : 'surfaceDeep'} align='center' justify='center'>
								<Icon as={a.icon} boxSize={5} color={a.earned ? a.color : 'textSecondary'} />
							</Flex>
							<Box>
								<Text fontSize='sm' fontWeight='800' color='textPrimary'>{a.name}</Text>
								<Text fontSize='10px' color='textSecondary'>{a.desc}</Text>
							</Box>
						</HStack>
					</Box>
				))}
			</SimpleGrid>

			{/* Recent Activity */}
			<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest' mb={3}>RECENT ACTIVITY</Text>
			<VStack spacing={0} align='stretch' bg='surface' borderRadius='16px' border='1px solid' borderColor='border' overflow='hidden'>
				{allTx.length === 0 ? (
					<Box p={6} textAlign='center'><Text color='textSecondary' fontSize='sm'>No activity yet.</Text></Box>
				) : allTx.slice(0, 10).map((tx, i) => (
					<Box key={tx.id}>
						<Flex justify='space-between' align='center' p={4}>
							<Box>
								<Text fontWeight='700' fontSize='sm' color='textPrimary'>{tx.description || tx.type}</Text>
								<Text fontSize='10px' color='textSecondary'>{tx.createdAt?.toDate?.()?.toLocaleDateString() || 'Recent'}</Text>
							</Box>
							<Text fontFamily='JetBrains Mono' fontWeight='800' fontSize='md' color={tx.amount > 0 ? 'yesAction' : 'noAction'}>
								{tx.amount > 0 ? '+' : ''}{tx.amount} BT
							</Text>
						</Flex>
						{i < Math.min(allTx.length, 10) - 1 && <Divider borderColor='border' ml={4} w='calc(100% - 16px)' />}
					</Box>
				))}
			</VStack>
		</Box>
	);
};

export default ProfilePage;
