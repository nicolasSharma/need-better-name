import { useState, useEffect, useMemo, useCallback } from 'react';
import {
	Box, Flex, Text, VStack, HStack, Button, Input, IconButton, Icon, Badge,
	Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
	useDisclosure, useToast, Avatar, Divider, Progress
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthProvider';
import { useRoommates } from '@/context/AppDataProvider';
import { createPoll, votePoll, closePoll } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import EmptyState from '@/components/EmptyState';
import PullToRefresh from '@/components/PullToRefresh';
import Skeleton from '@/components/Skeleton';
import type { Poll } from '@/types';
import { IoAdd, IoClose, IoCheckmarkCircle, IoTrashOutline, IoChatbubblesOutline, IoLockClosedOutline, IoShareOutline } from 'react-icons/io5';

const PollCard = ({ poll, userId, roommateMap }: { poll: Poll; userId: string; roommateMap: Record<string, string> }) => {
	const toast = useToast();

	const totalVotes = useMemo(() => {
		return Object.values(poll.votes).reduce((acc, arr) => acc + arr.length, 0);
	}, [poll.votes]);

	const myVote = useMemo(() => {
		for (const [idx, voters] of Object.entries(poll.votes)) {
			if (voters.includes(userId)) return parseInt(idx);
		}
		return -1;
	}, [poll.votes, userId]);

	const handleVote = async (optionIndex: number) => {
		triggerHaptic();
		try {
			await votePoll(poll.id, userId, optionIndex);
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	const handleClose = async () => {
		triggerHaptic();
		try {
			await closePoll(poll.id);
			toast({ title: 'Poll closed', status: 'info' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	const creatorName = roommateMap[poll.creatorId] || 'Unknown';
	const isCreator = poll.creatorId === userId;
	const isClosed = poll.status === 'closed';

	// Find winning option
	const winIdx = useMemo(() => {
		let maxVotes = 0;
		let maxIdx = -1;
		Object.entries(poll.votes).forEach(([idx, voters]) => {
			if (voters.length > maxVotes) { maxVotes = voters.length; maxIdx = parseInt(idx); }
		});
		return maxIdx;
	}, [poll.votes]);

	return (
		<Box
			as={motion.div}
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			bg='surface'
			borderRadius='20px'
			border='1px solid'
			borderColor={isClosed ? 'border' : 'border'}
			overflow='hidden'
			opacity={isClosed ? 0.7 : 1}
		>
			<Box p={5}>
				<Flex justify='space-between' align='start' mb={3}>
					<Box flex={1}>
						<Text fontWeight='800' fontSize='md' color='textPrimary' lineHeight='1.3' mb={1}>
							{poll.question}
						</Text>
						<HStack spacing={2}>
							<Text fontSize='10px' color='textSecondary' fontWeight='600'>
								by {creatorName}
							</Text>
							<Text fontSize='10px' color='textSecondary'>·</Text>
							<Text fontSize='10px' color='textSecondary' fontWeight='600'>
								{totalVotes} vote{totalVotes !== 1 ? 's' : ''}
							</Text>
							{isClosed && (
								<Badge colorScheme='gray' borderRadius='full' fontSize='8px' px={2}>CLOSED</Badge>
							)}
						</HStack>
					</Box>
					<HStack spacing={1}>
						<IconButton
							icon={<IoShareOutline />}
							aria-label='Share poll'
							variant='ghost'
							size='sm'
							color='textSecondary'
							onClick={async () => {
								const url = `${window.location.origin}/polls`;
								if (navigator.share) {
									try {
										await navigator.share({
											title: poll.question,
											text: `Vote on this House Poll: ${poll.question}`,
											url: url
										});
									} catch (e) {}
								} else {
									navigator.clipboard.writeText(url);
									toast({ title: 'Link copied!', status: 'success', duration: 1500 });
								}
							}}
						/>
						{isCreator && !isClosed && (
							<IconButton
								icon={<IoLockClosedOutline />}
								aria-label='Close poll'
								variant='ghost'
								size='sm'
								color='textSecondary'
								onClick={handleClose}
							/>
						)}
					</HStack>
				</Flex>

				<VStack spacing={2} align='stretch'>
					{poll.options.map((option, idx) => {
						const optVotes = poll.votes[idx.toString()]?.length || 0;
						const pct = totalVotes > 0 ? (optVotes / totalVotes) * 100 : 0;
						const isMyVote = myVote === idx;
						const isWinner = isClosed && idx === winIdx;

						return (
							<Box
								key={idx}
								position='relative'
								bg={isMyVote ? 'rgba(10,132,255,0.08)' : 'surfaceDeep'}
								borderRadius='12px'
								border='1px solid'
								borderColor={isMyVote ? 'primaryAction' : 'border'}
								overflow='hidden'
								cursor={isClosed ? 'default' : 'pointer'}
								onClick={isClosed ? undefined : () => handleVote(idx)}
								_active={isClosed ? {} : { transform: 'scale(0.98)' }}
								transition='all 0.15s'
							>
								{/* Progress background */}
								<Box
									position='absolute'
									top={0}
									left={0}
									h='100%'
									w={`${pct}%`}
									bg={isMyVote ? 'rgba(10,132,255,0.12)' : isWinner ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.03)'}
									transition='width 0.5s ease'
									borderRadius='12px'
								/>

								<Flex justify='space-between' align='center' p={3} position='relative' zIndex={1}>
									<HStack spacing={2}>
										{isMyVote && <Icon as={IoCheckmarkCircle} color='primaryAction' boxSize={4} />}
										<Text fontWeight={isMyVote ? '800' : '600'} fontSize='sm' color={isMyVote ? 'primaryAction' : 'textPrimary'}>
											{option}
										</Text>
									</HStack>
									<Text fontFamily='JetBrains Mono' fontWeight='800' fontSize='xs' color={isMyVote ? 'primaryAction' : 'textSecondary'}>
										{pct.toFixed(0)}%
									</Text>
								</Flex>
							</Box>
						);
					})}
				</VStack>

				{/* Voter avatars */}
				{totalVotes > 0 && (
					<Flex mt={3} gap={-1} flexWrap='wrap'>
						{Object.values(poll.votes).flat().slice(0, 8).map((voterId, i) => (
							<Avatar key={i} size='xs' name={roommateMap[voterId] || '?'} ml={i > 0 ? -1 : 0} border='2px solid' borderColor='surface' />
						))}
						{totalVotes > 8 && (
							<Text fontSize='10px' color='textSecondary' ml={1} mt={1}>+{totalVotes - 8} more</Text>
						)}
					</Flex>
				)}
			</Box>
		</Box>
	);
};

const PollsPage = () => {
	const { user } = useAuth();
	const { roommates } = useRoommates();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const toast = useToast();

	const [polls, setPolls] = useState<Poll[]>([]);
	const [loading, setLoading] = useState(true);
	const [question, setQuestion] = useState('');
	const [options, setOptions] = useState(['', '']);
	const [creating, setCreating] = useState(false);

	const roommateMap = useMemo(() => {
		const map: Record<string, string> = {};
		roommates.forEach(r => { map[r.id] = r.displayName?.split(' ')[0] || 'User'; });
		return map;
	}, [roommates]);

	useEffect(() => {
		const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
		const unsub = onSnapshot(q, (snap) => {
			setPolls(snap.docs.map(d => ({ id: d.id, ...d.data() } as Poll)));
			setLoading(false);
		});
		return unsub;
	}, []);

	const handleCreate = async () => {
		const trimmedQ = question.trim();
		const trimmedOpts = options.map(o => o.trim()).filter(o => o.length > 0);
		if (!trimmedQ || trimmedOpts.length < 2 || !user) {
			toast({ title: 'Need a question and at least 2 options', status: 'warning' });
			return;
		}
		setCreating(true);
		try {
			await createPoll(user.uid, trimmedQ, trimmedOpts);
			triggerHaptic();
			toast({ title: 'Poll created!', status: 'success' });
			setQuestion('');
			setOptions(['', '']);
			onClose();
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
		setCreating(false);
	};

	const handleRefresh = useCallback(async () => {
		await new Promise(r => setTimeout(r, 400));
	}, []);

	const openPolls = polls.filter(p => p.status === 'open');
	const closedPolls = polls.filter(p => p.status === 'closed');

	return (
		<PullToRefresh onRefresh={handleRefresh}>
		<Box p={6} pb={24} maxW='600px' mx='auto'>
			<Flex justify='space-between' align='center' mb={6}>
				<Box>
					<Text fontSize='2xl' fontWeight='900' color='textPrimary'>House Polls</Text>
					<Text color='textSecondary' fontSize='sm'>Quick votes on house decisions</Text>
				</Box>
				<IconButton
					icon={<IoAdd />}
					aria-label='Create poll'
					bg='primaryAction'
					color='white'
					borderRadius='14px'
					onClick={() => { triggerHaptic(); onOpen(); }}
					_active={{ transform: 'scale(0.9)' }}
				/>
			</Flex>

			{loading ? (
				<VStack spacing={4}>
					<Skeleton h='120px' borderRadius='20px' />
					<Skeleton h='120px' borderRadius='20px' />
				</VStack>
			) : openPolls.length === 0 && closedPolls.length === 0 ? (
				<EmptyState
					icon={IoChatbubblesOutline}
					title='No polls yet'
					subtitle='Start a poll to get the house voting on decisions, dinner plans, or anything else.'
					action={
						<Button size='sm' bg='primaryAction' color='white' borderRadius='10px' fontWeight='800' onClick={() => { triggerHaptic(); onOpen(); }}>
							Create First Poll
						</Button>
					}
				/>
			) : (
				<VStack spacing={4} align='stretch'>
					{openPolls.map(poll => (
						<PollCard key={poll.id} poll={poll} userId={user?.uid || ''} roommateMap={roommateMap} />
					))}
					{closedPolls.length > 0 && (
						<>
							<Text fontSize='10px' fontWeight='900' color='textSecondary' letterSpacing='widest' mt={4}>
								CLOSED POLLS
							</Text>
							{closedPolls.slice(0, 5).map(poll => (
								<PollCard key={poll.id} poll={poll} userId={user?.uid || ''} roommateMap={roommateMap} />
							))}
						</>
					)}
				</VStack>
			)}

			{/* Create Poll Modal */}
			<Modal isOpen={isOpen} onClose={onClose} size='full'>
				<ModalOverlay />
				<ModalContent bg='bg' m={0} borderRadius={0}>
					<ModalHeader borderBottom='1px solid' borderColor='border' pt='env(safe-area-inset-top, 24px)'>
						<Flex justify='space-between' align='center'>
							<Text fontSize='sm' fontWeight='900'>NEW POLL</Text>
							<IconButton icon={<IoClose />} variant='ghost' onClick={onClose} aria-label='Close' />
						</Flex>
					</ModalHeader>
					<ModalBody p={6}>
						<VStack spacing={5} align='stretch'>
							<Box>
								<Text fontSize='11px' fontWeight='800' color='textSecondary' letterSpacing='widest' mb={2}>QUESTION</Text>
								<Input
									placeholder='What should we order tonight?'
									value={question}
									onChange={e => setQuestion(e.target.value)}
									size='lg'
									bg='surface'
									borderRadius='14px'
									fontWeight='600'
								/>
							</Box>

							<Box>
								<Text fontSize='11px' fontWeight='800' color='textSecondary' letterSpacing='widest' mb={2}>OPTIONS</Text>
								<VStack spacing={2} align='stretch'>
									{options.map((opt, idx) => (
										<HStack key={idx}>
											<Input
												placeholder={`Option ${idx + 1}`}
												value={opt}
												onChange={e => {
													const newOpts = [...options];
													newOpts[idx] = e.target.value;
													setOptions(newOpts);
												}}
												bg='surface'
												borderRadius='12px'
											/>
											{options.length > 2 && (
												<IconButton
													icon={<IoTrashOutline />}
													aria-label='Remove'
													variant='ghost'
													size='sm'
													color='noAction'
													onClick={() => setOptions(options.filter((_, i) => i !== idx))}
												/>
											)}
										</HStack>
									))}
									<Button
										variant='ghost'
										size='sm'
										leftIcon={<IoAdd />}
										color='primaryAction'
										fontWeight='700'
										onClick={() => setOptions([...options, ''])}
									>
										Add Option
									</Button>
								</VStack>
							</Box>

							<Button
								bg='primaryAction'
								color='white'
								h='56px'
								borderRadius='16px'
								fontWeight='800'
								onClick={handleCreate}
								isLoading={creating}
								isDisabled={!question.trim() || options.filter(o => o.trim()).length < 2}
							>
								Create Poll
							</Button>
						</VStack>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Box>
		</PullToRefresh>
	);
};

export default PollsPage;
