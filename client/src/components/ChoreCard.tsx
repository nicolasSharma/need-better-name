import { useState, useRef } from 'react';
import { Box, Flex, Text, Badge, Button, useToast, Image, Input, Icon, VStack, HStack, Avatar, Collapse } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCameraOutline, IoCheckmarkCircle, IoTimeOutline, IoWalletOutline, IoCalendarOutline } from 'react-icons/io5';
import { Chore } from '@/hooks/useChores';
import { UserProfile } from '@/hooks/useUser';
import { claimChore, submitChoreForReview, bountifyChore } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
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

	const isMine = chore.assigneeId === user?.uid || chore.completedBy === user?.uid || (Array.isArray(chore.assignedTo) && chore.assignedTo.includes(user?.uid || ''));
	const isBounty = chore.type === 'bounty';

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
		
		const otherRoommates = roommates.filter(r => r.id !== user?.uid);
		let reviewerId = user?.uid;
		if (otherRoommates.length > 0) {
			reviewerId = otherRoommates[Math.floor(Math.random() * otherRoommates.length)].id;
		}

		try {
			await submitChoreForReview(chore.id, user!.uid, reviewerId as string, photoBase64);
			playChime();
			toast({ title: `Task sent for review!`, status: 'info', duration: 4000 });
			setExpanded(false);
		} catch (e: any) {
			toast({ title: 'Verification Error', description: e.message, status: 'error' });
		}
		setLoading(false);
	};

	const creator = isBounty ? roommates.find(r => r.id === chore.creatorId) : null;

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
					</Box>
					<Badge 
						colorScheme={chore.status === 'completed' ? 'gray' : chore.status === 'pending_review' ? 'orange' : chore.status === 'claimed' ? 'yellow' : 'green'} 
						borderRadius='6px' px={2} py={1} fontSize='10px'
					>
						{chore.status === 'pending_review' ? 'PENDING REVIEW' : chore.status.toUpperCase()}
					</Badge>
				</Flex>

				<Flex gap={4} mb={4} flexWrap='wrap'>
					<HStack spacing={1}>
						<Icon as={IoCheckmarkCircle} color={chore.status === 'completed' ? 'textSecondary' : 'textPrimary'} />
						<Text fontFamily='JetBrains Mono' fontWeight='700' fontSize='sm' color={chore.status === 'completed' ? 'textSecondary' : 'textPrimary'}>
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

				<HStack spacing={2}>
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
					{!isBounty && isMine && chore.status !== 'completed' && !outsourceExpanded && (
						<Button size='sm' bg='yellow.500' color='black' _hover={{ bg: 'yellow.400' }} border='1px solid' borderColor='yellow.400' onClick={() => setOutsourceExpanded(true)}>
							Outsource
						</Button>
					)}
				</HStack>

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
										Attach Photo Proof (Optional)
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
