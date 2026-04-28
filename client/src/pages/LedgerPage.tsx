import { useState, useEffect } from 'react';
import { Box, Flex, Text, VStack, Divider, Button, Image, HStack, Icon, Collapse, Badge, useToast } from '@chakra-ui/react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTransactions } from '@/hooks/useTransactions';
import { useUser, UserProfile } from '@/hooks/useUser';
import { IoImageOutline } from 'react-icons/io5';
import Skeleton from '@/components/Skeleton';
import AnimatedNumber from '@/components/AnimatedNumber';
import { triggerHaptic } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';
import { IoBarChartOutline, IoWalletOutline, IoCheckmarkCircle, IoCloseCircle, IoStatsChartOutline, IoShieldHalf } from 'react-icons/io5';
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
	const [isGlobal, setIsGlobal] = useState(false);
	const { transactions, loading } = useTransactions(isGlobal);
	const { profile } = useUser();
	const [roommates, setRoommates] = useState<Record<string, string>>({});
	const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

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
			const snap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
			const map: Record<string, string> = {};
			snap.docs.forEach(d => { map[d.id] = (d.data() as UserProfile).displayName.split(' ')[0]; });
			setRoommates(map);
		};
		fetchUsers();
	}, []);

	return (
		<Box pb={8}>
			<TutorialWizard 
				pageKey="ledger" 
				steps={[
					{
						title: "The Treasury",
						body: "Track every bet payout, chore reward, and perk purchase in high-fidelity history.",
						icon: IoBarChartOutline
					},
					{
						title: "Physical Settlement",
						body: "The ledger also tracks USD physical payments to keep your real-world house debts in sync.",
						icon: IoWalletOutline
					},
					{
						title: "Supreme Court",
						body: "When 'Awaiting Judgement' appears, you've been chosen as an impartial judge to verify a chore or settle a market. Your decision is final.",
						icon: IoShieldHalf
					}
				]} 
			/>

			<Box px={4} maxW='600px' mx='auto' mt={6}>
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
										<Box key={chore.id} bg='surface' p={5} borderRadius='16px' border='1px solid' borderColor='border' as={motion.div} layout>
											<Flex justify='space-between' align='flex-start' mb={2}>
												<Box>
													<Text fontSize='10px' color='textSecondary' fontWeight='800' letterSpacing='widest' mb={1}>CHORE VERIFICATION</Text>
													<Text fontWeight='900' color='textPrimary' fontSize='lg' lineHeight='1.2'>{chore.name}</Text>
													<Text fontSize='xs' color='textSecondary' fontWeight='600' mt={1}>
														Completed by {chore.completedBy ? roommates[chore.completedBy] || 'Unknown' : 'Unknown'}
													</Text>
												</Box>
												<Text fontFamily='JetBrains Mono' fontWeight='900' fontSize='xl' color='primaryAction'>{chore.reward} BT</Text>
											</Flex>
											{chore.photoUrl && (
												<Box mt={3} borderRadius='12px' overflow='hidden' border='1px solid' borderColor='border'>
													<Image src={chore.photoUrl} alt="Proof" maxH='200px' w='100%' objectFit='cover' />
												</Box>
											)}
											<HStack mt={5} spacing={3}>
												<Button flex={2} h='50px' bg='yesAction' color='white' leftIcon={<IoCheckmarkCircle />} isLoading={actionLoading === chore.id} onClick={() => handleApprove(chore.id)} _hover={{ filter: 'brightness(110%)' }} _active={{ transform: 'scale(0.98)' }} fontWeight='800'>
													APPROVE
												</Button>
												<Button flex={1} h='50px' bg='transparent' color='textSecondary' border='1px solid' borderColor='border' isLoading={actionLoading === chore.id} onClick={() => handleReject(chore.id)} _hover={{ bg: 'noAction', color: 'white', borderColor: 'noAction' }} fontWeight='800'>
													REJECT
												</Button>
											</HStack>
										</Box>
									))}

									{pendingMarkets.map(market => (
										<Box key={market.id} bg='surface' p={5} borderRadius='16px' border='1px solid' borderColor='border' as={motion.div} layout>
											<Flex justify='space-between' align='flex-start' mb={2}>
												<Box>
													<Text fontSize='10px' color='textSecondary' fontWeight='800' letterSpacing='widest' mb={1}>MARKET SETTLEMENT</Text>
													<Text fontWeight='900' color='textPrimary' fontSize='lg' lineHeight='1.2'>{market.question}</Text>
													<Text fontSize='sm' color='textSecondary' fontWeight='700' mt={2}>
														Proposed Winner: <Badge colorScheme='green' fontSize='xs' px={2} borderRadius='4px'>{market.proposedOutcome}</Badge>
													</Text>
												</Box>
												<Icon as={IoStatsChartOutline} color='primaryAction' boxSize={6} opacity={0.8} />
											</Flex>
											<HStack mt={5} spacing={3}>
												<Button flex={2} h='50px' bg='yesAction' color='white' leftIcon={<IoCheckmarkCircle />} isLoading={actionLoading === market.id} onClick={() => handleApproveMarket(market.id, market.proposedOutcome!)} _hover={{ filter: 'brightness(110%)' }} _active={{ transform: 'scale(0.98)' }} fontWeight='800'>
													CONFIRM
												</Button>
												<Button flex={1} h='50px' bg='transparent' color='textSecondary' border='1px solid' borderColor='border' isLoading={actionLoading === market.id} onClick={() => handleRejectMarket(market.id)} _hover={{ bg: 'noAction', color: 'white', borderColor: 'noAction' }} fontWeight='800'>
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
				<Flex bg='surfaceDeep' p={1} borderRadius='12px' border='1px solid' borderColor='border' mb={4}>
					<Button flex={1} variant='unstyled' h='36px' fontSize='sm' fontWeight='600' bg={!isGlobal ? 'surface' : 'transparent'} color={!isGlobal ? 'textPrimary' : 'textSecondary'} borderRadius='10px' shadow={!isGlobal ? 'sm' : 'none'} onClick={() => { setIsGlobal(false); triggerHaptic(); }}>
						Personal
					</Button>
					<Button flex={1} variant='unstyled' h='36px' fontSize='sm' fontWeight='600' bg={isGlobal ? 'surface' : 'transparent'} color={isGlobal ? 'textPrimary' : 'textSecondary'} borderRadius='10px' shadow={isGlobal ? 'sm' : 'none'} onClick={() => { setIsGlobal(true); triggerHaptic(); }}>
						House
					</Button>
				</Flex>

				{loading ? (
					<VStack spacing={4} mt={4}>
						<Skeleton h='72px' borderRadius='16px' />
						<Skeleton h='72px' borderRadius='16px' />
						<Skeleton h='72px' borderRadius='16px' />
					</VStack>
				) : transactions.length === 0 ? (
					<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={6} mt={4} textAlign='center'>
						<Text color='textSecondary'>No transactions on record.</Text>
					</Box>
				) : (
					<VStack spacing={0} align='stretch' bg='surface' borderRadius='16px' border='1px solid' borderColor='border' overflow='hidden' mt={4}>
						{transactions.map((tx, index) => {
							const isPositive = tx.amount > 0;
							const isUSD = tx.type === 'usd_payment';
							const name = roommates[tx.userId] || 'System';
							const partnerName = tx.relatedId ? roommates[tx.relatedId] : null;

							return (
								<Box key={tx.id}>
									<Box py={4} px={4} _active={{ bg: 'border' }} transition='background 0.2s'>
										<Flex justify='space-between' align='flex-start' mb={tx.photoUrl ? 3 : 0}>
											<Box>
												<HStack spacing={2} mb={1}>
													{isGlobal && (
														<Badge colorScheme='gray' fontSize='9px' borderRadius='4px' px={1}>{name}</Badge>
													)}
													<Text fontWeight='600' color='textPrimary' fontSize='md' lineHeight='1.2'>
														{typeToLabel(tx.type, tx.amount)}
													</Text>
												</HStack>
												
												{tx.createdAt && (
													<Text fontSize='11px' color='textSecondary'>
														{tx.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
														{isUSD && partnerName && ` • To ${partnerName}`}
														{tx.type === 'bet_payout' && tx.resolvedBy && ` • Verified by ${roommates[tx.resolvedBy] || 'Unknown'}`}
													</Text>
												)}
											</Box>

											<Text 
												fontFamily={isUSD ? 'Hellix' : 'JetBrains Mono'} 
												fontWeight={isUSD ? '600' : '700'} 
												fontSize={isUSD ? 'md' : 'lg'}
												color={isUSD ? 'yesAction' : (isPositive ? 'yesAction' : 'textPrimary')}
												whiteSpace='nowrap'
												ml={3}
											>
												{isPositive && !isUSD ? '+' : ''}{isUSD ? `$${Math.abs(tx.amount).toFixed(2)}` : tx.amount} {isUSD ? '' : 'BT'}
											</Text>
										</Flex>
										
										{tx.photoUrl && (
											<Box>
												<Button size='xs' variant='surface' leftIcon={<IoImageOutline />} color='textSecondary' border='1px solid' borderColor='border' onClick={() => setExpandedPhoto(expandedPhoto === tx.id ? null : tx.id)}>
													{expandedPhoto === tx.id ? 'Hide Receipt' : 'View Proof'}
												</Button>
												<Collapse in={expandedPhoto === tx.id}>
													<Box mt={3} borderRadius='8px' overflow='hidden' border='1px solid' borderColor='border'>
														<Image src={tx.photoUrl} alt="Receipt" w='100%' maxH='300px' objectFit='cover' />
													</Box>
												</Collapse>
											</Box>
										)}
									</Box>
									{index < transactions.length - 1 && <Divider borderColor='border' ml={4} w='calc(100% - 16px)' />}
								</Box>
							);
						})}
					</VStack>
				)}
			</Box>
		</Box>
	);
};

export default LedgerPage;
