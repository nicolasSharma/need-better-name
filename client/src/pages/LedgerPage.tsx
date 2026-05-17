import { useState, useEffect } from 'react';
import { Box, Flex, Text, VStack, Divider, Button, Image, HStack, Icon, Collapse, Badge, useToast, Avatar, SimpleGrid, Heading } from '@chakra-ui/react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTransactions } from '@/hooks/useTransactions';
import { useUser, UserProfile } from '@/hooks/useUser';
import { IoImageOutline } from 'react-icons/io5';
import Skeleton from '@/components/Skeleton';
import AnimatedNumber from '@/components/AnimatedNumber';
import { triggerHaptic } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';
import { filterHouseMembers, isSystemAdmin } from '@/lib/admin';
import { 
	IoTrophyOutline, IoTrendingUpOutline, IoChevronForward, IoPersonOutline, 
	IoShieldHalf, IoBarChartOutline, IoWalletOutline, IoCheckmarkCircle, 
	IoCloseCircle, IoStatsChartOutline, IoLogOutOutline
} from 'react-icons/io5';
import { useAuth } from '@/hooks/useAuth';
import { useChores } from '@/hooks/useChores';
import { useMarkets } from '@/hooks/useMarkets';
import { approveChore, rejectChore, resolveMarket, rejectMarketResolution } from '@/lib/firestore';
import { motion, AnimatePresence } from 'framer-motion';

interface Roommate extends UserProfile { id: string; }

const typeToLabel = (type: string, amount: number) => {
	switch(type) {
		case 'chore_reward': return 'Chore Verified';
		case 'bounty_reward': return 'Bounty Verified';
		case 'bet_placed': return 'Contract Position (Stake)';
		case 'bet_payout': return 'Contract Settlement (Win)';
		case 'perk_purchase': return 'Utility Purchase';
		case 'usd_payment': return `USD Physical Payment`;
		default: return 'Ledger Entry';
	}
};

const LedgerPage = () => {
	console.log("Rendering LedgerPage...");
	const [isGlobal, setIsGlobal] = useState(true);
	const { transactions, loading: txLoading } = useTransactions(true);
	const { profile } = useUser();
	const [roommates, setRoommates] = useState<any[]>([]);
	const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const { user } = useAuth();
	const toast = useToast();
	
	const { chores } = useChores();
	const pendingChores = chores.filter(c => c.status === 'pending_review' && c.reviewerId === user?.uid);
	
	const { markets } = useMarkets();
	const pendingMarkets = markets.filter(m => m.status === 'pending_resolution' && m.reviewerId === user?.uid);

	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const handleApprove = async (choreId: string) => {
		setActionLoading(choreId);
		try {
			await approveChore(choreId, user!.uid);
			triggerHaptic();
			toast({ title: 'Task Approved', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	const handleReject = async (choreId: string) => {
		setActionLoading(choreId);
		try {
			await rejectChore(choreId, user!.uid);
			triggerHaptic();
			toast({ title: 'Task Rejected', status: 'info' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	const handleApproveMarket = async (marketId: string, outcome: string) => {
		setActionLoading(marketId);
		try {
			await resolveMarket(marketId, outcome, user!.uid);
			triggerHaptic();
			toast({ title: 'Settlement Confirmed', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	const handleRejectMarket = async (marketId: string) => {
		setActionLoading(marketId);
		try {
			await rejectMarketResolution(marketId, user!.uid);
			triggerHaptic();
			toast({ title: 'Settlement Rejected', status: 'info' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	useEffect(() => {
		const fetchUsers = async () => {
			const snap = await getDocs(query(collection(db, 'users'), orderBy('balance', 'desc')));
			setRoommates(filterHouseMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))));
		};
		fetchUsers();
	}, []);

	const roommateMap: Record<string, string> = {};
	(roommates || []).forEach(r => { 
		if (r?.displayName) {
			roommateMap[r.id] = r.displayName.split(' ')[0]; 
		} else if (r?.id) {
			roommateMap[r.id] = 'User';
		}
	});

	const selectedUser = (roommates || []).find(r => r.id === selectedUserId);
	const userTransactions = (transactions || []).filter(tx => tx?.userId === selectedUserId);
	const userChores = (chores || []).filter(c => 
		c && c.status !== 'completed' && (c.assigneeId === selectedUserId || (Array.isArray(c.assignedTo) && c.assignedTo.includes(selectedUserId || '')))
	);
	const userBets = (markets || []).filter(m => m && m.status === 'open').filter(m => {
		return userTransactions.some(tx => tx && tx.type === 'bet_placed' && tx.relatedId === m.id);
	});

	console.log("Ledger Data State:", { 
		roommates: roommates?.length, 
		transactions: transactions?.length, 
		selectedUserId 
	});

	return (
		<Box pb={8}>
			<TutorialWizard 
				pageKey="ledger" 
				steps={[
					{
						title: "The Leaderboard",
						body: "See who's currently dominating the house economy based on their BT balance.",
						icon: IoTrophyOutline
					},
					{
						title: "Detailed Intel",
						body: "Tap any roommate to see their active bets, pending chores, and full activity history.",
						icon: IoPersonOutline
					},
					{
						title: "Supreme Court",
						body: "When 'Awaiting Judgement' appears, you've been chosen as an impartial judge. Your decision is final.",
						icon: IoShieldHalf
					}
				]} 
			/>

			<Box px={4} maxW='600px' mx='auto' mt={6}>
				{/* Awaiting Judgement (Global) */}
				<AnimatePresence>
					{(pendingChores.length > 0 || pendingMarkets.length > 0) && (
						<Box 
							as={motion.div} 
							initial={{ opacity: 0, y: -20 }} 
							animate={{ opacity: 1, y: 0 }} 
							exit={{ opacity: 0, scale: 0.95 }}
							mb={8} 
							bgGradient='linear(to-br, rgba(255,149,0,0.1), rgba(255,59,48,0.05))' 
							p={1} 
							borderRadius='24px' 
							border='1px solid' 
							borderColor='orange.400'
							boxShadow='0 0 40px rgba(255, 149, 0, 0.15)'
						>
							<Box bg='surfaceDeep' borderRadius='22px' p={5}>
								<HStack mb={5} spacing={3} color='orange.400'>
									<Icon as={IoShieldHalf} boxSize={6} />
									<Text fontSize='sm' letterSpacing='widest' fontWeight='900' textTransform='uppercase'>
										Awaiting Judgement
									</Text>
								</HStack>
								<VStack spacing={4} align='stretch'>
									{pendingChores.map(chore => (
										<Box key={chore.id} bg='surface' p={5} borderRadius='16px' border='1px solid' borderColor='border'>
											<Flex justify='space-between' align='flex-start' mb={2}>
												<Box>
													<Text fontSize='10px' color='textSecondary' fontWeight='800' letterSpacing='widest' mb={1}>CHORE VERIFICATION</Text>
													<Text fontWeight='900' color='textPrimary' fontSize='lg' lineHeight='1.2'>{chore.name}</Text>
													<Text fontSize='xs' color='textSecondary' fontWeight='600' mt={1}>
														Completed by {chore.completedBy ? roommateMap[chore.completedBy] || 'Unknown' : 'Unknown'}
													</Text>
												</Box>
												<Text fontFamily='JetBrains Mono' fontWeight='900' fontSize='xl' color='primaryAction'>{chore.reward} BT</Text>
											</Flex>
											<HStack mt={5} spacing={3}>
												<Button flex={2} h='50px' bg='yesAction' color='white' leftIcon={<IoCheckmarkCircle />} isLoading={actionLoading === chore.id} onClick={() => handleApprove(chore.id)} fontWeight='800'>
													APPROVE
												</Button>
												<Button flex={1} h='50px' bg='transparent' color='textSecondary' border='1px solid' borderColor='border' isLoading={actionLoading === chore.id} onClick={() => handleReject(chore.id)} fontWeight='800'>
													REJECT
												</Button>
											</HStack>
										</Box>
									))}
									{pendingMarkets.map(market => (
										<Box key={market.id} bg='surface' p={5} borderRadius='16px' border='1px solid' borderColor='border'>
											<Flex justify='space-between' align='flex-start' mb={2}>
												<Box>
													<Text fontSize='10px' color='textSecondary' fontWeight='800' letterSpacing='widest' mb={1}>MARKET SETTLEMENT</Text>
													<Text fontWeight='900' color='textPrimary' fontSize='lg' lineHeight='1.2'>{market.question}</Text>
													<Badge colorScheme='green' mt={2}>{market.proposedOutcome}</Badge>
												</Box>
												<Icon as={IoStatsChartOutline} color='primaryAction' boxSize={6} />
											</Flex>
											<HStack mt={5} spacing={3}>
												<Button flex={2} h='50px' bg='yesAction' color='white' leftIcon={<IoCheckmarkCircle />} isLoading={actionLoading === market.id} onClick={() => handleApproveMarket(market.id, market.proposedOutcome!)} fontWeight='800'>
													CONFIRM
												</Button>
												<Button flex={1} h='50px' bg='transparent' color='textSecondary' border='1px solid' borderColor='border' isLoading={actionLoading === market.id} onClick={() => handleRejectMarket(market.id)} fontWeight='800'>
													DISPUTE
												</Button>
											</HStack>
										</Box>
									))}
								</VStack>
							</Box>
						</Box>
					)}
				</AnimatePresence>

				{!selectedUserId ? (
					<Box>
						<Heading size='lg' mb={6} fontWeight='900'>Leaderboard</Heading>
						<VStack spacing={3} align='stretch'>
							{roommates.map((r, i) => (
								<Flex 
									key={r.id} 
									bg='surface' 
									p={4} 
									borderRadius='16px' 
									border='1px solid' 
									borderColor='border' 
									align='center' 
									justify='space-between'
									onClick={() => { setSelectedUserId(r.id); triggerHaptic(); }}
									cursor='pointer'
									_active={{ transform: 'scale(0.98)', bg: 'border' }}
									transition='all 0.2s'
								>
									<HStack spacing={4}>
										<Flex w='32px' h='32px' bg={i === 0 ? 'yellow.400' : (i === 1 ? 'gray.300' : (i === 2 ? 'orange.300' : 'surfaceDeep'))} borderRadius='full' align='center' justify='center' fontWeight='900' fontSize='sm' color={i < 3 ? 'black' : 'textSecondary'}>
											{i + 1}
										</Flex>
										<Avatar size='sm' src={r.photoURL} name={r.displayName} />
										<Box>
											<Text fontWeight='700' color='textPrimary'>{r.displayName} {r.id === user?.uid && '(You)'}</Text>
											<Text fontSize='xs' color='textSecondary'>Ranked #{i+1}</Text>
										</Box>
									</HStack>
									<HStack spacing={3}>
										<Text fontFamily='JetBrains Mono' fontWeight='800' color='primaryAction'>{r.balance} BT</Text>
										<Icon as={IoChevronForward} color='border' />
									</HStack>
								</Flex>
							))}
						</VStack>
					</Box>
				) : (
					<Box as={motion.div} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
						<Button leftIcon={<IoChevronForward style={{ transform: 'rotate(180deg)' }} />} variant='ghost' size='sm' mb={6} onClick={() => setSelectedUserId(null)} color='textSecondary' px={0}>
							Back to Leaderboard
						</Button>

						<Flex align='center' gap={4} mb={8}>
							<Avatar size='xl' src={selectedUser?.photoURL} name={selectedUser?.displayName} border='2px solid' borderColor='primaryAction' p={1} />
							<Box>
								<Heading size='xl' fontWeight='900'>{selectedUser?.displayName}</Heading>
								<Text fontSize='2xl' fontWeight='800' color='yesAction' fontFamily='JetBrains Mono'>{selectedUser?.balance} BT</Text>
							</Box>
						</Flex>

						{/* Active Intel */}
						<SimpleGrid columns={1} spacing={4} mb={8}>
							<Box bg='surface' p={5} borderRadius='20px' border='1px solid' borderColor='border'>
								<Text fontSize='xs' fontWeight='900' color='textSecondary' mb={4} textTransform='uppercase' letterSpacing='widest'>Active Chores</Text>
								{userChores.length === 0 ? <Text fontSize='sm' color='textSecondary'>No pending tasks.</Text> : (
									<VStack align='stretch' spacing={3}>
										{userChores.map(c => (
											<Flex key={c.id} justify='space-between' align='center'>
												<Text fontWeight='700' fontSize='sm'>{c.name}</Text>
												<Badge borderRadius='full' px={2}>{c.reward} BT</Badge>
											</Flex>
										))}
									</VStack>
								)}
							</Box>

							<Box bg='surface' p={5} borderRadius='20px' border='1px solid' borderColor='border'>
								<Text fontSize='xs' fontWeight='900' color='textSecondary' mb={4} textTransform='uppercase' letterSpacing='widest'>Active Bets</Text>
								{userBets.length === 0 ? <Text fontSize='sm' color='textSecondary'>No open contracts.</Text> : (
									<VStack align='stretch' spacing={3}>
										{userBets.map(m => (
											<Flex key={m.id} justify='space-between' align='center'>
												<Text fontWeight='700' fontSize='sm' isTruncated maxW='70%'>{m.question}</Text>
												<Badge colorScheme='blue' borderRadius='full' px={2}>ACTIVE</Badge>
											</Flex>
										))}
									</VStack>
								)}
							</Box>
						</SimpleGrid>

						{/* Ledger */}
						<Text fontSize='xs' fontWeight='900' color='textSecondary' mb={4} textTransform='uppercase' letterSpacing='widest' px={2}>Activity Ledger</Text>
						<VStack spacing={0} align='stretch' bg='surface' borderRadius='20px' border='1px solid' borderColor='border' overflow='hidden'>
							{userTransactions.length === 0 ? <Box p={6} textAlign='center'><Text color='textSecondary' fontSize='sm'>Quiet history...</Text></Box> : (
								userTransactions.map((tx, i) => (
									<Box key={tx.id}>
										<Flex justify='space-between' align='center' p={4}>
											<Box>
												<Text fontWeight='700' fontSize='sm' color='textPrimary'>{tx.description || typeToLabel(tx.type, tx.amount)}</Text>
												<Text fontSize='10px' color='textSecondary'>{tx.createdAt && typeof tx.createdAt.toDate === 'function' ? tx.createdAt.toDate().toLocaleDateString() : 'Recent'}</Text>
											</Box>
											<Text fontFamily='JetBrains Mono' fontWeight='800' fontSize='md' color={tx.amount > 0 ? 'yesAction' : 'textPrimary'}>
												{tx.amount > 0 ? '+' : ''}{tx.amount}
											</Text>
										</Flex>
										{i < userTransactions.length - 1 && <Divider borderColor='border' ml={4} w='calc(100% - 16px)' />}
									</Box>
								))
							)}
						</VStack>
					</Box>
				)}
			</Box>
		</Box>
	);
};

export default LedgerPage;
