import { useState, useEffect } from 'react';
import {
	Box, Flex, Text, VStack, SimpleGrid, Button, Input, NumberInput, NumberInputField,
	Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
	useDisclosure, useToast, HStack, Avatar, Select, Checkbox, Switch
} from '@chakra-ui/react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useChores } from '@/hooks/useChores';
import { useUser, UserProfile } from '@/hooks/useUser';
import { createChore } from '@/lib/firestore';
import ChoreCard from '@/components/ChoreCard';
import { triggerHaptic } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';
import { IoCheckmarkCircleOutline, IoRocketOutline, IoShieldHalf } from 'react-icons/io5';
import { filterHouseMembers } from '@/lib/admin';


interface Roommate extends UserProfile { id: string; }

const ChoresPage = () => {
	const { user } = useAuth();
	const { profile } = useUser();
	const { chores } = useChores();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const toast = useToast();

	const [roommates, setRoommates] = useState<Roommate[]>([]);
	const [activeTab, setActiveTab] = useState<string>(user?.uid || 'bounty');
	const [filter, setFilter] = useState<'open' | 'completed'>('open');

	// Create Form State
	const [newName, setNewName] = useState('');
	const [newReward, setNewReward] = useState('100');
	const [isBounty, setIsBounty] = useState(false);
	const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly'>('none');
	const [assignedTo, setAssignedTo] = useState<string[]>([user?.uid || '']);
	const [assignAll, setAssignAll] = useState(false);
	const [dueDate, setDueDate] = useState('');

	useEffect(() => {
		const fetchUsers = async () => {
			const snap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
			setRoommates(filterHouseMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Roommate))));
		};
		fetchUsers();
	}, []);

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
				dueDate ? dueDate : null
			);
			triggerHaptic();
			toast({ title: isBounty ? 'Bounty Posted' : 'Chore Created', status: 'success' });
			onClose();
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	// --- Filtering Logic ---
	// If Bounty Board: Show bounties.
	// If User Tab: Show chores where assignedTo contains user or 'all', or completedBy user.
	const displayChores = chores.filter((c) => {
		if (activeTab === 'bounty') {
			if (c.type !== 'bounty') return false;
			return filter === 'open' ? c.status !== 'completed' : c.status === 'completed';
		} else {
			if (c.type === 'bounty') return false; // Filter out bounties from personal tasks
			
			if (filter === 'completed') {
				if (activeTab === 'all_house') return c.status === 'completed'; // Everyone
				return c.status === 'completed' && c.completedBy === activeTab;
			} else {
				// Open Tasks
				if (c.status === 'completed') return false;
				if (activeTab === 'all_house') return true; // Show all house tasks
				
				// If claimed, only show to the claimer
				if (c.status === 'claimed' && c.assigneeId !== activeTab) return false;
				// If not claimed, check assignments
				if (activeTab === 'all_house') return true; 
				if (c.assignedTo === 'all') return true;
				return Array.isArray(c.assignedTo) && c.assignedTo.includes(activeTab);
			}
		}
	});

	return (
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

			<Flex justify='space-between' align='center' mb={6}>
				<Box>
					<Text fontSize='2xl' fontWeight='800' color='textPrimary' fontFamily='Hellix'>
						Action Board
					</Text>
					<Text color='textSecondary' fontSize='sm' mt={1}>
						Complete work, verify, earn BT
					</Text>
				</Box>

			</Flex>

			{/* The User Avatars Navigation Dock */}
			<HStack overflowX='auto' spacing={4} pb={4} mb={4} sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
				<VStack spacing={1} cursor='pointer' onClick={() => { setActiveTab('bounty'); triggerHaptic(); }} opacity={activeTab === 'bounty' ? 1 : 0.5}>
					<Flex w='56px' h='56px' borderRadius='full' bg={activeTab === 'bounty' ? 'primaryAction' : 'surfaceDeep'} border='2px solid' borderColor={activeTab === 'bounty' ? 'primaryAction' : 'border'} align='center' justify='center' shadow={activeTab === 'bounty' ? '0 0 15px rgba(255, 191, 0, 0.4)' : 'none'}>
						<Text fontSize='2xl'>🏴‍☠️</Text>
					</Flex>
					<Text fontSize='xs' fontWeight='700' color='textPrimary'>Bounties</Text>
				</VStack>

				<VStack spacing={1} cursor='pointer' onClick={() => { setActiveTab('all_house'); triggerHaptic(); }} opacity={activeTab === 'all_house' ? 1 : 0.5}>
					<Flex w='56px' h='56px' borderRadius='full' bg={activeTab === 'all_house' ? 'primaryAction' : 'surfaceDeep'} border='2px solid' borderColor={activeTab === 'all_house' ? 'primaryAction' : 'border'} align='center' justify='center'>
						<Text fontSize='xl'>🌐</Text>
					</Flex>
					<Text fontSize='xs' fontWeight='700' color='textPrimary'>All Floor</Text>
				</VStack>

				{roommates.map((r) => (
					<VStack key={r.id} spacing={1} cursor='pointer' onClick={() => { setActiveTab(r.id); triggerHaptic(); }} opacity={activeTab === r.id ? 1 : 0.4} transition='opacity 0.2s'>
						<Avatar size='lg' name={r.displayName} bg={r.color} color='white' border={activeTab === r.id ? '2px solid white' : 'none'} shadow={activeTab === r.id ? '0 4px 10px rgba(0,0,0,0.3)' : 'none'} />
						<Text fontSize='xs' fontWeight='600' color='textPrimary'>
							{r.id === user?.uid ? 'You' : r.displayName.split(' ')[0]}
						</Text>
					</VStack>
				))}
			</HStack>

			{/* Sub-Filters */}
			<Flex bg='surfaceDeep' p={1} borderRadius='12px' border='1px solid' borderColor='border' mb={6}>
				<Button flex={1} variant='unstyled' h='36px' fontSize='sm' fontWeight='600' bg={filter === 'open' ? 'surface' : 'transparent'} color={filter === 'open' ? 'textPrimary' : 'textSecondary'} borderRadius='10px' shadow={filter === 'open' ? 'sm' : 'none'} onClick={() => { setFilter('open'); triggerHaptic(); }}>
					To Do
				</Button>
				<Button flex={1} variant='unstyled' h='36px' fontSize='sm' fontWeight='600' bg={filter === 'completed' ? 'surface' : 'transparent'} color={filter === 'completed' ? 'textPrimary' : 'textSecondary'} borderRadius='10px' shadow={filter === 'completed' ? 'sm' : 'none'} onClick={() => { setFilter('completed'); triggerHaptic(); }}>
					Verified
				</Button>
			</Flex>

			{/* Rendering The Cards */}
			{displayChores.length === 0 ? (
				<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={8} textAlign='center'>
					<Text color='textSecondary' fontWeight='500'>
						{activeTab === 'bounty' ? 'No bounties posted to the market.' : 'No tasks in this queue.'}
					</Text>
				</Box>
			) : (
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					{displayChores.map((c) => <ChoreCard key={c.id} chore={c} roommates={roommates} />)}
				</SimpleGrid>
			)}

		</Box>
	);
};

export default ChoresPage;
