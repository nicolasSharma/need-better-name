import { useState, useRef, useEffect } from 'react';
import { Box, Flex, Text, Badge, Button, useToast, Image, Input, Icon, VStack, HStack, Avatar } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCameraOutline, IoCheckmarkCircle, IoTimeOutline, IoWalletOutline, IoCalendarOutline, IoFlashOutline, IoShieldHalf } from 'react-icons/io5';
import type { Chore } from '@/types';
import type { UserProfile } from '@/types';
import { claimChore, submitChoreForReview, bountifyChore, challengeChore, voteOnChallenge, approveChore } from '@/lib/services';
import { useAuth } from '@/context/AuthProvider';
import { triggerHaptic } from '@/lib/haptics';
import { playThump, playChime } from '@/lib/audio';
import Confetti from '@/components/Confetti';

interface Roommate extends UserProfile { id: string; }

const ChoreCard = ({ chore, roommates }: { chore: Chore, roommates: Roommate[] }) => {
	const { user } = useAuth();
	const toast = useToast();
	const [expanded, setExpanded] = useState(false);
	const [outsourceExpanded, setOutsourceExpanded] = useState(false);
	const [bountyAmount, setBountyAmount] = useState('');
	const [loading, setLoading] = useState(false);
	const [photoBase64, setPhotoBase64] = useState<string | null>(null);
	const [fireConfetti, setFireConfetti] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [timeRemaining, setTimeRemaining] = useState('');

	const isMine = chore.assigneeId === user?.uid || chore.completedBy === user?.uid || (Array.isArray(chore.assignedTo) && chore.assignedTo.includes(user?.uid || ''));
	const isBounty = chore.type === 'bounty';

	useEffect(() => {
		if (!chore.challengeDeadline || chore.status !== 'pending_review') return;
		const interval = setInterval(() => {
			const deadline = chore.challengeDeadline.toMillis ? chore.challengeDeadline.toMillis() : (chore.challengeDeadline.seconds * 1000);
			const diff = deadline - Date.now();
			if (diff <= 0) {
				setTimeRemaining('Expired');
				approveChore(chore.id).catch(console.error);
				clearInterval(interval);
			} else {
				const hours = Math.floor(diff / (1000 * 60 * 60));
				const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				setTimeRemaining(`${hours}h ${mins}m left to challenge`);
			}
		}, 60000);

		const deadline = chore.challengeDeadline.toMillis ? chore.challengeDeadline.toMillis() : (chore.challengeDeadline.seconds * 1000);
		const diff = deadline - Date.now();
		if (diff <= 0) {
			setTimeRemaining('Expired');
			approveChore(chore.id).catch(console.error);
		} else {
			const hours = Math.floor(diff / (1000 * 60 * 60));
			const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
			setTimeRemaining(`${hours}h ${mins}m left to challenge`);
		}

		return () => clearInterval(interval);
	}, [chore.challengeDeadline, chore.status, chore.id]);

	const handleClaim = async () => {
		triggerHaptic();
		try {
			await claimChore(chore.id, user!.uid);
			toast({ title: 'Task claimed', status: 'success', duration: 2000 });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	const handleBountify = async () => {
		const amt = parseInt(bountyAmount);
		if (!amt || amt < 10) return toast({ title: 'Minimum bounty 10 BT', status: 'warning' });
		
		setLoading(true);
		try {
			await bountifyChore(chore.id, user!.uid, amt);
			triggerHaptic();
			toast({ title: 'Task Bountified!', status: 'success' });
			setOutsourceExpanded(false);
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setLoading(false);
	};

	const handlePhotoSelect = (e: any) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const img = document.createElement('img');
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const MAX_WIDTH = 800;
				const scaleSize = MAX_WIDTH / img.width;
				canvas.width = MAX_WIDTH;
				canvas.height = img.height * scaleSize;

				const ctx = canvas.getContext('2d');
				ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
				
				const base64 = canvas.toDataURL('image/jpeg', 0.6);
				setPhotoBase64(base64);
				triggerHaptic();
			};
			img.src = event.target?.result as string;
		};
		reader.readAsDataURL(file);
	};

	const handleComplete = async () => {
		setLoading(true);
		try {
			await submitChoreForReview(chore.id, user!.uid, photoBase64);
			playChime();
			toast({ title: `Task submitted for review!`, description: 'Housemates have 24 hours to challenge or it auto-approves.', status: 'info', duration: 5000 });
			setExpanded(false);
		} catch (e: any) {
			toast({ title: 'Verification Error', description: e.message, status: 'error' });
		}
		setLoading(false);
	};

	const handleChallenge = async () => {
		if (!user) return;
		setLoading(true);
		try {
			await challengeChore(chore.id, user.uid);
			toast({ title: 'Dispute filed!', description: 'Housemates must now vote to resolve.', status: 'info' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setLoading(false);
	};

	const handleVote = async (vote: 'approve' | 'reject') => {
		if (!user) return;
		setLoading(true);
		try {
			await voteOnChallenge(chore.id, user.uid, vote);
			toast({ title: 'Vote submitted', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setLoading(false);
	};

	const creator = isBounty ? roommates.find(r => r.id === chore.creatorId) : null;
	const claimer = roommates.find(r => r.id === chore.assigneeId);
	const challenger = roommates.find(r => r.id === chore.challengedBy);

	const votes = chore.challengeVotes || {};
	const approveVotes = Object.values(votes).filter(v => v === 'approve').length;
	const rejectVotes = Object.values(votes).filter(v => v === 'reject').length;
	const myVote = user ? votes[user.uid] : null;

	const isCompletedByUser = chore.completedBy === user?.uid;
	const isChallenger = chore.challengedBy === user?.uid;
	const canVote = chore.status === 'challenged' && user && !isCompletedByUser && !isChallenger;

	return (
		<Box position='relative'>
			<Confetti fire={fireConfetti} />
			
			<Box as={motion.div}
				whileHover={chore.status === 'open' ? { scale: 1.01 } : {}}
				bg={isBounty ? 'surfaceDeep' : 'surface'}
				border='1px solid'
				borderColor={isBounty ? 'primaryAction' : 'border'}
				borderRadius='16px'
				p={5}
				overflow='hidden'
			>
				<Flex justify='space-between' align='flex-start' mb={3}>
					<Box>
						{isBounty && (
							<HStack spacing={1} mb={2}>
								<Icon as={IoWalletOutline} color='primaryAction' />
								<Text fontSize='10px' color='primaryAction' fontWeight='700' letterSpacing='widest' textTransform='uppercase'>
									{creator ? `${creator.displayName}'s Bounty` : 'Bounty'}
								</Text>
							</HStack>
						)}
						<Text fontFamily='Hellix' fontWeight='700' color='textPrimary' fontSize='lg' lineHeight='1.2'>
							{chore.name}
						</Text>
						{chore.status === 'claimed' && claimer && (
							<HStack mt={1} spacing={1}>
								<Avatar size='xxs' name={claimer.displayName} src={claimer.photoURL} />
								<Text fontSize='xs' color='textSecondary' fontWeight='600'>
									Claimed by {claimer.displayName?.split(' ')[0]}
								</Text>
							</HStack>
						)}
					</Box>
					<Badge 
						variant='subtle'
						colorScheme={chore.status === 'completed' ? 'gray' : chore.status === 'pending_review' ? 'orange' : chore.status === 'challenged' ? 'red' : chore.status === 'claimed' ? 'yellow' : 'green'} 
						borderRadius='8px' px={3} py={1} fontSize='10px' fontWeight='900' letterSpacing='wider'
					>
						{chore.status === 'pending_review' ? 'VERIFYING' : chore.status === 'challenged' ? 'CHALLENGED' : chore.status.toUpperCase()}
					</Badge>
				</Flex>

				<Flex align='center' gap={3} mb={4}>
					{chore.priority && (
						<HStack spacing={1} bg={chore.priority === 'high' ? 'rgba(255,59,48,0.12)' : chore.priority === 'medium' ? 'rgba(10,132,255,0.12)' : 'rgba(142,142,147,0.12)'} px={2} py={0.5} borderRadius='full' border='1px solid' borderColor={chore.priority === 'high' ? 'red.400' : chore.priority === 'medium' ? 'blue.400' : 'gray.400'}>
							<Box w='6px' h='6px' borderRadius='full' bg={chore.priority === 'high' ? 'red.400' : chore.priority === 'medium' ? 'blue.400' : 'gray.400'} />
							<Text fontSize='9px' fontWeight='900' color={chore.priority === 'high' ? 'red.500' : chore.priority === 'medium' ? 'blue.500' : 'gray.500'} textTransform='uppercase'>{chore.priority}</Text>
						</HStack>
					)}
					<HStack spacing={1} color={chore.reward >= 200 ? 'primaryAction' : 'textPrimary'}>
						<Icon as={IoFlashOutline} />
						<Text fontFamily='JetBrains Mono' fontWeight='900' fontSize='sm'>
							{chore.reward} BT
						</Text>
					</HStack>
					{chore.recurring && chore.recurring !== 'none' && (
						<HStack spacing={1} color='textSecondary'>
							<Icon as={IoTimeOutline} />
							<Text fontSize='xs' fontWeight='600' textTransform='capitalize'>{chore.recurring}</Text>
						</HStack>
					)}
					{chore.dueDate && (
						<HStack spacing={1} color={new Date(chore.dueDate) < new Date() && chore.status !== 'completed' ? 'red.400' : 'textSecondary'}>
							<Icon as={IoCalendarOutline} />
							<Text fontSize='xs' fontWeight='600'>
								Due: {new Date(chore.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
							</Text>
						</HStack>
					)}
				</Flex>

				{chore.photoUrl && (
					<Box mb={4} borderRadius='8px' overflow='hidden' border='1px solid' borderColor='border'>
						<Image src={chore.photoUrl} alt="Verification" w='100%' maxH='200px' objectFit='cover' />
					</Box>
				)}

				<HStack spacing={2} w='100%'>
					{chore.status === 'open' && (
						<Button flex={1} size='sm' variant='surface' color='textPrimary' border='1px solid' borderColor='border' onClick={handleClaim}>
							Claim Task
						</Button>
					)}

					{chore.status === 'claimed' && chore.assigneeId === user?.uid && !expanded && (
						<Button flex={1} size='sm' bg='textPrimary' color='surface' _hover={{ opacity: 0.8 }} onClick={() => setExpanded(true)}>
							Mark as Done
						</Button>
					)}

					{/* Outsource Button if it's assigned to me and hasn't been completed yet */}
					{!isBounty && isMine && chore.status !== 'completed' && chore.status !== 'pending_review' && chore.status !== 'challenged' && !outsourceExpanded && (
						<Button size='sm' bg='yellow.500' color='black' _hover={{ bg: 'yellow.400' }} border='1px solid' borderColor='yellow.400' onClick={() => setOutsourceExpanded(true)}>
							Outsource
						</Button>
					)}
				</HStack>

				{/* Challenge Action UI */}
				{chore.status === 'pending_review' && (
					<VStack w='100%' mt={3} p={3} bg='blackAlpha.200' borderRadius='12px' align='stretch' spacing={2}>
						<HStack justify='space-between'>
							<HStack spacing={1}>
								<Icon as={IoTimeOutline} color='orange.400' />
								<Text fontSize='xs' fontWeight='700' color='orange.400'>{timeRemaining}</Text>
							</HStack>
							<Text fontSize='9px' fontWeight='bold' color='textSecondary'>PENDING AUTO-APPROVAL</Text>
						</HStack>
						{!isCompletedByUser && (
							<Button size='xs' colorScheme='red' variant='solid' leftIcon={<span>⚔️</span>} onClick={handleChallenge} isLoading={loading}>
								Challenge Task
							</Button>
						)}
					</VStack>
				)}

				{/* Voting UI for Challenged Chores */}
				{chore.status === 'challenged' && (
					<VStack w='100%' mt={3} p={4} bg='red.500' bgOpacity={0.08} border='1px solid' borderColor='red.500' borderRadius='16px' align='stretch' spacing={3}>
						<HStack spacing={2}>
							<Icon as={IoShieldHalf} color='red.500' />
							<Text fontSize='sm' fontWeight='900' color='textPrimary'>DISPUTE ACTIVE</Text>
						</HStack>
						<Text fontSize='xs' color='textSecondary'>
							{challenger ? `${challenger.displayName?.split(' ')[0]} challenged this completion claim.` : 'This task completion was challenged.'}
						</Text>
						<HStack justify='space-between' bg='blackAlpha.300' p={2} borderRadius='8px'>
							<Text fontSize='xs' fontWeight='bold'>VOTE TALLY:</Text>
							<Text fontSize='xs' fontWeight='bold' color='green.500'>{approveVotes} Approve</Text>
							<Text fontSize='xs' fontWeight='bold' color='red.500'>{rejectVotes} Reject</Text>
						</HStack>

						{canVote && (
							<VStack spacing={2} align='stretch' pt={2}>
								<Text fontSize='xs' fontWeight='bold' color='textSecondary'>CAST YOUR VOTE:</Text>
								<HStack spacing={2}>
									<Button flex={1} size='sm' colorScheme='green' onClick={() => handleVote('approve')} isLoading={loading} isDisabled={myVote === 'approve'}>
										Approve {myVote === 'approve' && '✓'}
									</Button>
									<Button flex={1} size='sm' colorScheme='red' onClick={() => handleVote('reject')} isLoading={loading} isDisabled={myVote === 'reject'}>
										Reject {myVote === 'reject' && '✓'}
									</Button>
								</HStack>
							</VStack>
						)}
						{myVote && !canVote && (
							<Badge alignSelf='center' colorScheme={myVote === 'approve' ? 'green' : 'red'} variant='outline'>
								You voted: {myVote.toUpperCase()}
							</Badge>
						)}
					</VStack>
				)}

				<AnimatePresence>
					{outsourceExpanded && (
						<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
							<VStack spacing={3} mt={4} pt={4} borderTop='1px solid' borderColor='border'>
								<Box w='100%'>
									<Text fontSize='10px' color='textSecondary' fontWeight='700' letterSpacing='widest' mb={2} textTransform='uppercase'>
										PAY FROM WALLET TO OUTSOURCE
									</Text>
									<HStack>
										<Input 
											type='number' 
											placeholder='Bounty BT (e.g. 50)' 
											value={bountyAmount} 
											onChange={(e) => setBountyAmount(e.target.value)}
											bg='bg' 
											fontFamily='JetBrains Mono' 
										/>
										<Button colorScheme='yellow' isLoading={loading} onClick={handleBountify}>
											Post Bounty
										</Button>
									</HStack>
								</Box>
							</VStack>
						</motion.div>
					)}
				</AnimatePresence>

				<AnimatePresence>
					{expanded && (
						<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
							<VStack spacing={3} mt={4} pt={4} borderTop='1px solid' borderColor='border'>
								<Input type="file" accept="image/*" capture="environment" ref={fileInputRef} display="none" onChange={handlePhotoSelect} />
								
								{!photoBase64 ? (
									<Button w='100%' variant='surface' leftIcon={<IoCameraOutline />} onClick={() => fileInputRef.current?.click()} h='50px'>
										📸 Add Photo (Optional)
									</Button>
								) : (
									<Box position='relative' w='100%' borderRadius='8px' overflow='hidden'>
										<Image src={photoBase64} w='100%' h='120px' objectFit='cover' />
										<Button position='absolute' top={2} right={2} size='xs' colorScheme='red' onClick={() => setPhotoBase64(null)}>Remove</Button>
									</Box>
								)}

								<Button w='100%' h='50px' bg='primaryAction' color='white' isLoading={loading} onClick={handleComplete} _active={{ transform: 'scale(0.95)' }}>
									Submit for Review
								</Button>
							</VStack>
						</motion.div>
					)}
				</AnimatePresence>
			</Box>
		</Box>
	);
};

export default ChoreCard;
