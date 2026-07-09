import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
	Box, Flex, Text, VStack, SimpleGrid, Button, Input, NumberInput, NumberInputField,
	Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
	useDisclosure, useToast, HStack, Avatar, Select, Switch, Icon, IconButton, Divider
} from '@chakra-ui/react';
import { useAuth } from '@/context/AuthProvider';
import { useChores, useUser, useRoommates } from '@/context/AppDataProvider';
import { createChore } from '@/lib/services';
import ChoreCard from '@/components/ChoreCard';
import { triggerHaptic } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';
import PullToRefresh from '@/components/PullToRefresh';
import { IoCheckmarkCircleOutline, IoRocketOutline, IoShieldHalf, IoAdd, IoStatsChartOutline, IoTrophyOutline } from 'react-icons/io5';

const ChoresPage = () => {
	const { user } = useAuth();
	const { profile } = useUser();
	const { chores } = useChores();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const toast = useToast();

	const { roommates } = useRoommates();
	const [activeTab, setActiveTab] = useState<string>('all_house');
	const [filter, setFilter] = useState<'open' | 'completed' | 'bounty'>('open');

	// Create Form State
	const [newName, setNewName] = useState('');
	const [newReward, setNewReward] = useState('100');
	const [isBounty, setIsBounty] = useState(false);
	const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly'>('none');
	const [assignedTo, setAssignedTo] = useState<string[]>([user?.uid || '']);
	const [assignAll, setAssignAll] = useState(false);
	const [dueDate, setDueDate] = useState('');
	const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
	const [hidden, setHidden] = useState(false);

	useEffect(() => {
		if (user && activeTab === 'bounty' && !roommates.length) setActiveTab(user.uid);
	}, [user]);

	const handleOpenCreate = () => {
		triggerHaptic();
		setNewName('');
		setNewReward('100');
		setIsBounty(false);
		setRecurring('none');
		setAssignAll(false);
		setAssignedTo([user?.uid || '']);
		setDueDate('');
		setPriority('medium');
		setHidden(false);
		onOpen();
	};

	const handleCreate = async () => {
		if (!newName || !user) return;
		try {
			await createChore(
				newName,
				parseInt(newReward) || 100,
				user.uid,
				isBounty ? 'bounty' : 'house',
				recurring,
				assignAll ? 'all' : assignedTo,
				dueDate ? dueDate : null,
				priority,
				hidden
			);
			triggerHaptic();
			toast({ title: isBounty ? 'Bounty Posted' : 'Chore Created', status: 'success' });
			onClose();
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	// --- Filtering Logic ---
	const displayChores = chores.filter((c) => {
		// Filter out hidden tasks if user is not creator or assignee
		if (c.hidden && c.status !== 'completed') {
			const isCreator = c.creatorId === user?.uid;
			const isAssignee = Array.isArray(c.assignedTo) && c.assignedTo.includes(user?.uid || '');
			if (!isCreator && !isAssignee) return false;
		}

		if (filter === 'bounty') {
			if (c.type !== 'bounty') return false;
			if (activeTab !== 'all_house' && c.creatorId !== activeTab) return false;
			return c.status !== 'completed';
		}

		if (c.type === 'bounty') return false; // Filter out bounties from personal/house lists

		if (filter === 'completed') {
			if (activeTab === 'all_house') return c.status === 'completed';
			return c.status === 'completed' && c.completedBy === activeTab;
		} else {
			// Open Tasks
			if (c.status === 'completed') return false;
			if (activeTab === 'all_house') return true;
			
			if (c.status === 'claimed' && c.assigneeId !== activeTab) return false;
			if (c.assignedTo === 'all') return true;
			return Array.isArray(c.assignedTo) && c.assignedTo.includes(activeTab);
		}
	});

	const handleRefresh = useCallback(async () => {
		await new Promise(r => setTimeout(r, 400));
	}, []);

	return (
		<PullToRefresh onRefresh={handleRefresh}>
		<Box p={8} pb={24} maxW='800px'>
			<TutorialWizard 
				pageKey="chores" 
				steps={[
					{
						title: "Clean The Floor",
						body: "Complete recurring house tasks to keep the house running and earn basic BT rewards.",
						icon: IoCheckmarkCircleOutline
					},
					{
						title: "Bounty Markets",
						body: "If a chore is too much, 'Outsource' it! Pay your own BT to turn a task into a global Bounty.",
						icon: IoRocketOutline
					},
					{
						title: "Peer Verification",
						body: "When you finish a task, a random housemate is assigned to verify your work before the BT reward is released to your balance.",
						icon: IoShieldHalf
					}
				]} 
			/>

			<Flex justify='space-between' align='center' mb={4}>
				<Box>
					<Text fontSize='2xl' fontWeight='800' color='textPrimary' fontFamily='Hellix'>
						Action Board
					</Text>
					<Text color='textSecondary' fontSize='sm' mt={1}>
						Complete work, verify, earn BT
					</Text>
				</Box>
			</Flex>

			{/* Board Pulse Stats */}
			<HStack spacing={4} mb={8} w='100%'>
				<Box flex={1} bg='surface' p={4} borderRadius='24px' border='1px solid' borderColor='border' boxShadow='sm'>
					<HStack>
						<Icon as={IoStatsChartOutline} color='primaryAction' />
						<VStack align='start' spacing={0}>
							<Text fontSize='10px' fontWeight='800' color='textSecondary' textTransform='uppercase'>Active Pulse</Text>
							<Text fontSize='md' fontWeight='900'>{chores.filter(c => c.status !== 'completed').length} Tasks</Text>
						</VStack>
					</HStack>
				</Box>
				<Box flex={1} bg='surface' p={4} borderRadius='24px' border='1px solid' borderColor='border' boxShadow='sm'>
					<HStack>
						<Icon as={IoShieldHalf} color='orange.400' />
						<VStack align='start' spacing={0}>
							<Text fontSize='10px' fontWeight='800' color='textSecondary' textTransform='uppercase'>In Review</Text>
							<Text fontSize='md' fontWeight='900'>{chores.filter(c => c.status === 'pending_review' || c.status === 'challenged').length} Active</Text>
						</VStack>
					</HStack>
				</Box>
			</HStack>

			{/* The User Avatars Navigation Dock */}
			<Box bg='surfaceDeep' p={2} borderRadius='32px' mb={8} border='1px solid' borderColor='border' backdropFilter='blur(10px)'>
				<HStack overflowX='auto' spacing={4} px={2} py={2} sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
					<VStack spacing={1} cursor='pointer' onClick={() => { setActiveTab('all_house'); triggerHaptic(); }} opacity={activeTab === 'all_house' ? 1 : 0.5}>
						<Flex w='56px' h='56px' borderRadius='full' bg={activeTab === 'all_house' ? 'primaryAction' : 'surface'} border='2px solid' borderColor={activeTab === 'all_house' ? 'primaryAction' : 'border'} align='center' justify='center' transition='all 0.2s'>
							<Text fontSize='xl'>🌐</Text>
						</Flex>
						<Text fontSize='xs' fontWeight='800' color='textPrimary'>All Floor</Text>
					</VStack>

					{roommates.map((r) => {
						const completions = chores.filter(c => c.completedBy === r.id && c.status === 'completed').length;
						const isHero = completions > 0 && completions === Math.max(...roommates.map(rm => chores.filter(c => c.completedBy === rm.id && c.status === 'completed').length));
						
						return (
							<VStack key={r.id} spacing={1} cursor='pointer' onClick={() => { setActiveTab(r.id); triggerHaptic(); }} opacity={activeTab === r.id ? 1 : 0.4} transition='opacity 0.2s' position='relative'>
								{isHero && (
									<Box position='absolute' top='-10px' zIndex={5} transform='rotate(-15deg)'>
										<Icon as={IoTrophyOutline} color='yellow.400' filter='drop-shadow(0 0 5px rgba(236, 201, 75, 0.8))' boxSize={5} />
									</Box>
								)}
								<Avatar size='lg' name={r.displayName} bg={r.color} color='white' border={activeTab === r.id ? '2px solid white' : 'none'} shadow={activeTab === r.id ? '0 8px 16px rgba(0,0,0,0.3)' : 'none'} />
								<Text fontSize='xs' fontWeight='700' color='textPrimary'>
									{r.id === user?.uid ? 'You' : r.displayName.split(' ')[0]}
								</Text>
							</VStack>
						);
					})}
				</HStack>
			</Box>

			{/* Sub-Filters */}
			<Flex bg='surfaceDeep' p={1} borderRadius='14px' border='1px solid' borderColor='border' mb={8}>
				<Button flex={1} variant='unstyled' h='40px' fontSize='sm' fontWeight='800' bg={filter === 'open' ? 'surface' : 'transparent'} color={filter === 'open' ? 'textPrimary' : 'textSecondary'} borderRadius='10px' shadow={filter === 'open' ? 'sm' : 'none'} onClick={() => { setFilter('open'); triggerHaptic(); }}>
					TO DO
				</Button>
				<Button flex={1} variant='unstyled' h='40px' fontSize='sm' fontWeight='800' bg={filter === 'bounty' ? 'surface' : 'transparent'} color={filter === 'bounty' ? 'textPrimary' : 'textSecondary'} borderRadius='10px' shadow={filter === 'bounty' ? 'sm' : 'none'} onClick={() => { setFilter('bounty'); triggerHaptic(); }}>
					BOUNTIES
				</Button>
				<Button flex={1} variant='unstyled' h='40px' fontSize='sm' fontWeight='800' bg={filter === 'completed' ? 'surface' : 'transparent'} color={filter === 'completed' ? 'textPrimary' : 'textSecondary'} borderRadius='10px' shadow={filter === 'completed' ? 'sm' : 'none'} onClick={() => { setFilter('completed'); triggerHaptic(); }}>
					VERIFIED
				</Button>
			</Flex>

			{/* Rendering The Cards */}
			{displayChores.length === 0 ? (
				<Box bg='surface' borderRadius='24px' border='1px solid' borderColor='border' p={12} textAlign='center' shadow='inner'>
					<VStack spacing={4}>
						<Icon as={IoCheckmarkCircleOutline} boxSize={12} color='textSecondary' opacity={0.2} />
						<Text color='textSecondary' fontWeight='700' fontSize='lg'>
							{activeTab === 'bounty' ? 'Bounty market is clear.' : 'Your action queue is empty.'}
						</Text>
						<Button size='sm' variant='ghost' color='primaryAction' onClick={handleOpenCreate}>Create a Task</Button>
					</VStack>
				</Box>
			) : (
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} as={motion.div} layout>
					<AnimatePresence mode='popLayout'>
						{displayChores.map((c) => (
							<Box key={c.id} as={motion.div} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
								<ChoreCard chore={c} roommates={roommates} />
							</Box>
						))}
					</AnimatePresence>
				</SimpleGrid>
			)}

			<IconButton
				icon={<IoAdd size={28} />}
				aria-label='Create task'
				position='fixed'
				bottom='100px'
				right='24px'
				colorScheme='yellow'
				size='lg'
				h='64px'
				w='64px'
				borderRadius='full'
				boxShadow='0 8px 32px rgba(255, 191, 0, 0.4)'
				onClick={handleOpenCreate}
				zIndex={100}
				_hover={{ transform: 'scale(1.1) translateY(-4px)' }}
				_active={{ transform: 'scale(0.95)' }}
			/>

			{/* Create Task Modal Updates */}
			<Modal isOpen={isOpen} onClose={onClose} isCentered size='md'>
				<ModalOverlay backdropFilter='blur(10px)' bg='blackAlpha.600' />
				<ModalContent bg='surface' borderRadius='32px' border='1px solid' borderColor='border' overflow='hidden'>
					<ModalHeader color='textPrimary' pt={8}>{isBounty ? 'Post a Custom Bounty' : 'Post New Task'}</ModalHeader>
					<ModalCloseButton color='textSecondary' top={8} right={6} />
					<ModalBody pb={10} px={8}>
						<VStack spacing={6}>
							<Box w='100%'>
								<Text fontSize='10px' fontWeight='900' color='textSecondary' mb={2} letterSpacing='widest' textTransform='uppercase'>{isBounty ? 'BOUNTY DESCRIPTION' : 'TASK NAME'}</Text>
								<Input h='56px' placeholder={isBounty ? "I'll pay someone to do my dishes" : "What needs to be done?"} value={newName} onChange={(e) => setNewName(e.target.value)} borderRadius='16px' bg='surfaceDeep' border='none' fontSize='md' fontWeight='700' />
							</Box>

							<HStack w='100%' spacing={4}>
								<Box flex={1}>
									<Text fontSize='10px' fontWeight='900' color='textSecondary' mb={2} letterSpacing='widest' textTransform='uppercase'>BT REWARD</Text>
									<NumberInput value={newReward} onChange={(v) => setNewReward(v)} min={1}>
										<NumberInputField h='56px' borderRadius='16px' bg='surfaceDeep' border='none' fontWeight='800' fontFamily='JetBrains Mono' />
									</NumberInput>
								</Box>
								<Box flex={1}>
									<Text fontSize='10px' fontWeight='900' color='textSecondary' mb={2} letterSpacing='widest' textTransform='uppercase'>PRIORITY</Text>
									<Select h='56px' value={priority} onChange={(e) => setPriority(e.target.value as any)} borderRadius='16px' bg='surfaceDeep' border='none' fontWeight='700'>
										<option value='low'>Low</option>
										<option value='medium'>Medium</option>
										<option value='high'>High</option>
									</Select>
								</Box>
							</HStack>

							<Box w='100%'>
								<Text fontSize='10px' fontWeight='900' color='textSecondary' mb={3} letterSpacing='widest' textTransform='uppercase'>TASK CLASSIFICATION</Text>
								<VStack spacing={0} bg='surfaceDeep' borderRadius='16px' border='1px solid' borderColor='border' divider={<Divider borderColor='border' />}>
									<Flex w='100%' justify='space-between' align='center' p={4}>
										<Box>
											<Text fontSize='sm' fontWeight='700'>Custom Bounty</Text>
											<Text fontSize='xs' color='textSecondary'>Pay out of your own pocket</Text>
										</Box>
										<Switch isChecked={isBounty} onChange={(e) => setIsBounty(e.target.checked)} colorScheme='yellow' />
									</Flex>
									{isBounty && (
										<Box p={4} w='100%' bg='rgba(255, 191, 0, 0.1)'>
											<Text fontSize='xs' color='yellow.500' fontWeight='700'>
												This will deduct {parseInt(newReward) || 0} BT from your personal wallet and hold it in escrow.
											</Text>
										</Box>
									)}
									{!isBounty && (
										<Flex w='100%' justify='space-between' align='center' p={4}>
											<Box>
												<Text fontSize='sm' fontWeight='700'>Broadcast to All</Text>
												<Text fontSize='xs' color='textSecondary'>Visible to everyone's queue</Text>
											</Box>
											<Switch isChecked={assignAll} onChange={(e) => setAssignAll(e.target.checked)} colorScheme='yellow' />
										</Flex>
									)}
									{!isBounty && !assignAll && (
										<Flex w='100%' justify='space-between' align='center' p={4}>
											<Box>
												<Text fontSize='sm' fontWeight='700'>Hidden Task 🔒</Text>
												<Text fontSize='xs' color='textSecondary'>Only you and the assignee can see this until done</Text>
											</Box>
											<Switch isChecked={hidden} onChange={(e) => setHidden(e.target.checked)} colorScheme='yellow' />
										</Flex>
									)}
								</VStack>
							</Box>

							<Button 
								w='100%' h='64px' colorScheme={isBounty ? 'yellow' : 'blue'} fontSize='lg' fontWeight='900' 
								onClick={handleCreate} borderRadius='20px' 
								shadow={isBounty ? '0 8px 16px rgba(255, 191, 0, 0.3)' : 'none'}
								isDisabled={isBounty && (profile?.balance || 0) < (parseInt(newReward) || 0)}
							>
								{isBounty && (profile?.balance || 0) < (parseInt(newReward) || 0) ? 'INSUFFICIENT FUNDS' : isBounty ? 'POST BOUNTY' : 'ACTIVATE TASK'}
							</Button>
						</VStack>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Box>
		</PullToRefresh>
	);
};

export default ChoresPage;
