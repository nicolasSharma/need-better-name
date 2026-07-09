import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, Text, VStack, Divider, Button, Image, HStack, Icon, Collapse, Badge, useToast, Avatar, SimpleGrid, Heading, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, useDisclosure } from '@chakra-ui/react';
import { IoImageOutline } from 'react-icons/io5';
import Skeleton from '@/components/Skeleton';
import AnimatedNumber from '@/components/AnimatedNumber';
import PullToRefresh from '@/components/PullToRefresh';
import { triggerHaptic } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';
import { isSystemAdmin } from '@/lib/admin';
import { 
	IoTrophyOutline, IoTrendingUpOutline, IoChevronForward, IoPersonOutline, 
	IoShieldHalf, IoBarChartOutline, IoWalletOutline, IoCheckmarkCircle, 
	IoCloseCircle, IoStatsChartOutline, IoLogOutOutline, IoVolumeHighOutline
} from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { useUser, useChores, useMarkets, useTransactions, useRoommates } from '@/context/AppDataProvider';
import { approveChore, rejectChore, resolveMarket, rejectMarketResolution, challengeChore, voteOnChallenge } from '@/lib/services';
import { motion, AnimatePresence } from 'framer-motion';
import type { Roommate } from '@/types';

const isOnline = (lastActiveAt: any) => {
	if (!lastActiveAt) return false;
	const date = lastActiveAt.toDate ? lastActiveAt.toDate() : new Date(lastActiveAt);
	const diff = Date.now() - date.getTime();
	return diff < 45000; // 45 seconds (heartbeat is 30s)
};

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
	const [isGlobal, setIsGlobal] = useState(true);
	const { transactions, loading: txLoading } = useTransactions();
	const { profile } = useUser();
	const { roommates: roommateList } = useRoommates();
	const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const { user } = useAuth();
	const toast = useToast();
	
	const { chores } = useChores();
	const pendingChores = chores.filter(c => {
		if (c.status === 'pending_review') {
			return c.completedBy !== user?.uid;
		}
		if (c.status === 'challenged') {
			const hasVoted = c.challengeVotes && c.challengeVotes[user?.uid || ''];
			return c.completedBy !== user?.uid && c.challengedBy !== user?.uid && !hasVoted;
		}
		return false;
	});
	
	const { markets } = useMarkets();
	const pendingMarkets = markets.filter(m => m.status === 'pending_resolution' && m.reviewerId === user?.uid);

	const [actionLoading, setActionLoading] = useState<string | null>(null);

	const handleChallenge = async (choreId: string) => {
		if (!user) return;
		setActionLoading(choreId);
		try {
			await challengeChore(choreId, user.uid);
			triggerHaptic();
			toast({ title: 'Task Challenged ⚔️', status: 'info' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	const handleVote = async (choreId: string, vote: 'approve' | 'reject') => {
		if (!user) return;
		setActionLoading(choreId);
		try {
			await voteOnChallenge(choreId, user.uid, vote);
			triggerHaptic();
			toast({ title: 'Vote Submitted', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	const handleApprove = async (choreId: string) => {
		setActionLoading(choreId);
		try {
			await approveChore(choreId);
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
			await rejectChore(choreId);
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

	const handlePing = async (targetId: string) => {
		if (!user) return;
		setActionLoading(`ping_${targetId}`);
		try {
			const { sendPing } = await import('@/lib/services/pings');
			await sendPing(user.uid, targetId, 100);
			triggerHaptic();
			toast({ title: 'Ping Sent!', description: 'They will be notified shortly.', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	const { isOpen: isSoundboardOpen, onOpen: openSoundboard, onClose: closeSoundboard } = useDisclosure();

	const handleTaunt = async (soundId: string) => {
		if (!user || !selectedUserId) return;
		setActionLoading(`taunt_${soundId}`);
		try {
			const { sendTaunt } = await import('@/lib/services/taunts');
			await sendTaunt(user.uid, selectedUserId, soundId, 20);
			triggerHaptic();
			toast({ title: 'Taunt Sent! 🔊', description: 'Triggered sound effect on their device.', status: 'success' });
			closeSoundboard();
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	// Roommates sorted by balance for leaderboard
	const roommates = useMemo(() => {
		return [...roommateList].sort((a, b) => b.balance - a.balance);
	}, [roommateList]);

	const roommateMap: Record<string, string> = {};
	(roommates || []).forEach(r => { 
		if (r?.displayName) {
			roommateMap[r.id] = r.displayName.split(' ')[0]; 
		} else if (r?.id) {
			roommateMap[r.id] = 'User';
		}
	});

	// Titles calculation
	const userTitles = useMemo(() => {
		const titles: Record<string, { label: string, color: string, icon: string }[]> = {};
		
		const losses: Record<string, number> = {};
		const choresDone: Record<string, number> = {};
		const marketWins: Record<string, number> = {};

		(transactions || []).forEach(tx => {
			if (tx.type.startsWith('gamble_') && tx.amount < 0) {
				losses[tx.userId] = (losses[tx.userId] || 0) + Math.abs(tx.amount);
			}
			if (tx.type === 'bet_placed' && tx.amount < 0) {
				losses[tx.userId] = (losses[tx.userId] || 0) + Math.abs(tx.amount);
			}
			if (tx.type === 'bet_payout' && tx.amount > 0) {
				marketWins[tx.userId] = (marketWins[tx.userId] || 0) + 1;
			}
		});

		(chores || []).forEach(c => {
			if (c.status === 'completed' && c.completedBy) {
				choresDone[c.completedBy] = (choresDone[c.completedBy] || 0) + 1;
			}
		});

		let maxLosses = 0; let degen = null;
		Object.entries(losses).forEach(([uid, amt]) => { if (amt > maxLosses) { maxLosses = amt; degen = uid; } });

		let maxChores = 0; let cleanFreak = null;
		Object.entries(choresDone).forEach(([uid, count]) => { if (count > maxChores) { maxChores = count; cleanFreak = uid; } });

		let maxWins = 0; let oracle = null;
		Object.entries(marketWins).forEach(([uid, count]) => { if (count > maxWins) { maxWins = count; oracle = uid; } });

		let maxBal = -Infinity; let minBal = Infinity;
		let whale = null; let broke = null;
		
		(roommateList || []).forEach(r => {
			if (r.balance > maxBal) { maxBal = r.balance; }
			if (r.balance < minBal) { minBal = r.balance; }
		});

		// Only award wealth-based badges if there's an actual wealth gap in the house
		if (maxBal !== minBal) {
			(roommateList || []).forEach(r => {
				if (r.balance === maxBal && !whale) { whale = r.id; }
				if (r.balance === minBal && !broke) { broke = r.id; }
			});
		}

		const addTitle = (uid: string | null, title: any) => {
			if (uid) {
				if (!titles[uid]) titles[uid] = [];
				titles[uid].push(title);
			}
		};

		if (maxLosses > 0) addTitle(degen, { label: 'Biggest Degenerate', color: 'red', icon: '🎰' });
		if (maxChores > 0) addTitle(cleanFreak, { label: 'Clean Freak', color: 'teal', icon: '🧹' });
		if (maxWins > 0) addTitle(oracle, { label: 'The Oracle', color: 'purple', icon: '🔮' });
		if (roommateList && roommateList.length > 1 && maxBal !== minBal) {
			addTitle(whale, { label: 'Money Bags', color: 'blue', icon: '💰' });
			addTitle(broke, { label: 'Broke Boy', color: 'orange', icon: '📉' });
		}

		return titles;
	}, [transactions, chores, roommateList]);

	const selectedUser = (roommates || []).find(r => r.id === selectedUserId);
	const userTransactions = (transactions || []).filter(tx => tx?.userId === selectedUserId);
	const userChores = (chores || []).filter(c => 
		c && c.status !== 'completed' && (c.assigneeId === selectedUserId || (Array.isArray(c.assignedTo) && c.assignedTo.includes(selectedUserId || '')))
	);
	const userBets = (markets || []).filter(m => m && m.status === 'open').filter(m => {
		return userTransactions.some(tx => tx && tx.type === 'bet_placed' && tx.relatedId === m.id);
	});

	const handleRefresh = useCallback(async () => {
		await new Promise(r => setTimeout(r, 400));
	}, []);

	const rankEmojis = ['🥇', '🥈', '🥉'];

	return (
		<PullToRefresh onRefresh={handleRefresh}>
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
													<Text fontSize='10px' color='textSecondary' fontWeight='800' letterSpacing='widest' mb={1}>
														{chore.status === 'challenged' ? 'CHORE DISPUTE (VOTE)' : 'CHORE VERIFICATION'}
													</Text>
													<Text fontWeight='900' color='textPrimary' fontSize='lg' lineHeight='1.2'>{chore.name}</Text>
													<Text fontSize='xs' color='textSecondary' fontWeight='600' mt={1}>
														Completed by {chore.completedBy ? roommateMap[chore.completedBy] || 'Unknown' : 'Unknown'}
													</Text>
													{chore.status === 'challenged' && (
														<Text fontSize='xs' color='red.400' fontWeight='700' mt={1}>
															Challenged by {chore.challengedBy ? roommateMap[chore.challengedBy] || 'Unknown' : 'Unknown'}
														</Text>
													)}
												</Box>
												<Text fontFamily='JetBrains Mono' fontWeight='900' fontSize='xl' color='primaryAction'>{chore.reward} BT</Text>
											</Flex>
											
											{chore.photoUrl && (
												<Box my={3} borderRadius='8px' overflow='hidden' border='1px solid' borderColor='border'>
													<Image src={chore.photoUrl} alt="Verification" maxH='120px' objectFit='cover' />
												</Box>
											)}

											{chore.status === 'pending_review' ? (
												<HStack mt={5} spacing={3}>
													<Button flex={1} h='50px' bg='red.500' color='white' leftIcon={<span>⚔️</span>} isLoading={actionLoading === chore.id} onClick={() => handleChallenge(chore.id)} fontWeight='800'>
														CHALLENGE TASK
													</Button>
												</HStack>
											) : (
												<VStack mt={5} align='stretch' spacing={3}>
													<HStack justify='space-between' bg='blackAlpha.300' p={2} borderRadius='8px'>
														<Text fontSize='xs' fontWeight='bold'>VOTES:</Text>
														<Text fontSize='xs' fontWeight='bold' color='green.500'>{Object.values(chore.challengeVotes || {}).filter(v => v === 'approve').length} Approve</Text>
														<Text fontSize='xs' fontWeight='bold' color='red.500'>{Object.values(chore.challengeVotes || {}).filter(v => v === 'reject').length} Reject</Text>
													</HStack>
													<HStack spacing={3}>
														<Button flex={1} h='50px' bg='yesAction' color='white' leftIcon={<IoCheckmarkCircle />} isLoading={actionLoading === chore.id} onClick={() => handleVote(chore.id, 'approve')} fontWeight='800'>
															VOTE APPROVE
														</Button>
														<Button flex={1} h='50px' bg='noAction' color='white' leftIcon={<IoCloseCircle />} isLoading={actionLoading === chore.id} onClick={() => handleVote(chore.id, 'reject')} fontWeight='800'>
															VOTE REJECT
														</Button>
													</HStack>
												</VStack>
											)}
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
										<Flex w='32px' h='32px' bg={i < 3 ? 'transparent' : 'surfaceDeep'} borderRadius='full' align='center' justify='center' fontWeight='900' fontSize={i < 3 ? 'lg' : 'sm'} color={i < 3 ? 'black' : 'textSecondary'}>
											{i < 3 ? rankEmojis[i] : i + 1}
										</Flex>
										<Box position="relative">
											<Avatar size='sm' src={r.photoURL} name={r.displayName} />
											{isOnline(r.lastActiveAt) && (
												<Box
													position="absolute"
													bottom="-1px"
													right="-1px"
													w="10px"
													h="10px"
													bg="green.400"
													borderRadius="full"
													border="2px solid"
													borderColor="surface"
													boxShadow="0 0 8px var(--chakra-colors-green-400)"
												/>
											)}
										</Box>
										<Box>
											<Text fontWeight='700' color='textPrimary'>
												{r.displayName} {r.id === user?.uid && '(You)'}
											</Text>
											<HStack spacing={1} mt={1}>
												<Text fontSize='xs' color='textSecondary'>Ranked #{i+1}</Text>
												{userTitles[r.id]?.map((title, idx) => (
													<Badge key={idx} colorScheme={title.color} fontSize='9px' borderRadius='full' px={1}>
														{title.icon} {title.label}
													</Badge>
												))}
											</HStack>
										</Box>
									</HStack>
									<HStack spacing={3}>
										<Text fontFamily='JetBrains Mono' fontWeight='800' color='primaryAction'><AnimatedNumber value={r.balance} /> BT</Text>
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

						<Flex align='center' justify='space-between' mb={8}>
							<Flex align='center' gap={4}>
								<Box position="relative">
									<Avatar size='xl' src={selectedUser?.photoURL} name={selectedUser?.displayName} border='2px solid' borderColor='primaryAction' p={1} />
									{selectedUser && isOnline(selectedUser.lastActiveAt) && (
										<Box
											position="absolute"
											bottom="2"
											right="2"
											w="16px"
											h="16px"
											bg="green.400"
											borderRadius="full"
											border="3px solid"
											borderColor="bg"
											boxShadow="0 0 12px var(--chakra-colors-green-400)"
										/>
									)}
								</Box>
								<Box>
									<Heading size='xl' fontWeight='900'>{selectedUser?.displayName}</Heading>
									<Text fontSize='2xl' fontWeight='800' color='yesAction' fontFamily='JetBrains Mono'>{selectedUser?.balance} BT</Text>
									<HStack spacing={2} mt={2} flexWrap='wrap'>
										{selectedUser && userTitles[selectedUser.id]?.map((title, idx) => (
											<Badge key={idx} colorScheme={title.color} fontSize='10px' borderRadius='full' px={2} py={0.5}>
												{title.icon} {title.label}
											</Badge>
										))}
									</HStack>
								</Box>
							</Flex>
						</Flex>
						
						{selectedUser && selectedUser.id !== user?.uid && (
							<HStack spacing={3} mb={8}>
								<Button
									flex={1}
									h='50px'
									bg='primaryAction'
									color='white'
									borderRadius='14px'
									fontWeight='900'
									leftIcon={<span style={{fontSize: '20px'}}>🚨</span>}
									onClick={() => handlePing(selectedUser.id)}
									isLoading={actionLoading === `ping_${selectedUser.id}`}
								>
									SEND PING (100 BT)
								</Button>
								<Button
									flex={1}
									h='50px'
									bg='surface'
									border='1px solid'
									borderColor='border'
									color='textPrimary'
									borderRadius='14px'
									fontWeight='900'
									leftIcon={<Icon as={IoVolumeHighOutline} boxSize={5} />}
									onClick={openSoundboard}
								>
									TAUNT (20 BT)
								</Button>
							</HStack>
						)}

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

		<Modal isOpen={isSoundboardOpen} onClose={closeSoundboard} isCentered>
			<ModalOverlay />
			<ModalContent bg='surfaceDeep' border='1px solid' borderColor='border' borderRadius='24px' maxW='380px' p={2} mx={4}>
				<ModalHeader fontWeight='900' fontSize='lg' borderBottom='1px solid' borderColor='border' pb={3}>
					🔊 Play Taunt Sound (20 BT)
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody py={6}>
					<VStack spacing={3} align='stretch'>
						{[
							{ id: 'airhorn', label: 'Airhorn 🎺', desc: 'Loud, obtrusive blast' },
							{ id: 'sad_trombone', label: 'Sad Trombone 😢', desc: 'Perfect for losses' },
							{ id: 'alarm', label: 'Alarm 🚨', desc: 'Urgent wake-up siren' },
							{ id: 'cheers', label: 'Cheers 🎉', desc: 'Congratulatory applause' },
							{ id: 'boo', label: 'Boo 👎', desc: 'Standard heckling' }
						].map((sound) => (
							<Button
								key={sound.id}
								h='64px'
								bg='surface'
								_hover={{ bg: 'border' }}
								_active={{ bg: 'border', transform: 'scale(0.98)' }}
								borderRadius='16px'
								border='1px solid'
								borderColor='border'
								display='flex'
								flexDirection='column'
								alignItems='start'
								justifyContent='center'
								px={4}
								isLoading={actionLoading === `taunt_${sound.id}`}
								onClick={() => handleTaunt(sound.id)}
								transition='all 0.1s'
							>
								<Text fontWeight='800' fontSize='md'>{sound.label}</Text>
								<Text fontSize='xs' color='textSecondary' fontWeight='500'>{sound.desc}</Text>
							</Button>
						))}
					</VStack>
				</ModalBody>
			</ModalContent>
		</Modal>
		</PullToRefresh>
	);
};

export default LedgerPage;
