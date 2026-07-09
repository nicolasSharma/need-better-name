import { useState, useCallback } from 'react';
import {
	Box, Flex, Text, VStack, Button, Input, NumberInput, NumberInputField, 
	Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
	useDisclosure, useToast, Select, Avatar, IconButton, Divider, HStack, Icon
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useMarkets, useUser, useRoommates } from '@/context/AppDataProvider';
import { useAuth } from '@/context/AuthProvider';
import { createMarket } from '@/lib/services';
import MarketCard from '@/components/MarketCard';
import Skeleton from '@/components/Skeleton';
import PullToRefresh from '@/components/PullToRefresh';
import { triggerHaptic } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';
import DailySpin from '@/components/DailySpin';
import { IoAdd, IoTrashOutline, IoGameControllerOutline, IoSearchOutline, IoCheckmarkCircleOutline, IoStatsChartOutline } from 'react-icons/io5';

const CasinoPage = () => {
	const navigate = useNavigate();
	const { markets, loading: marketsLoading } = useMarkets();
	const { user } = useAuth();
	const { profile, loading: profileLoading } = useUser();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const toast = useToast();

	const { roommates } = useRoommates();
	const [question, setQuestion] = useState('');
	const [betAmount, setBetAmount] = useState('100');
	const [options, setOptions] = useState<string[]>(['YES', 'NO']);
	const [selectedOption, setSelectedOption] = useState('YES');
	const [taggedUser, setTaggedUser] = useState<string>(''); 
	const [filter, setFilter] = useState<string>('all');

	const addOption = () => {
		triggerHaptic();
		setOptions([...options, '']);
	};

	const removeOption = (index: number) => {
		if (options.length <= 2) return;
		const newOptions = [...options];
		newOptions.splice(index, 1);
		setOptions(newOptions);
		if (selectedOption === options[index]) setSelectedOption(newOptions[0]);
	};

	const handleOptionChange = (index: number, val: string) => {
		const newOptions = [...options];
		newOptions[index] = val;
		setOptions(newOptions);
	};

	const handleCreate = async () => {
		if (!question || !user) return;
		const cleanOptions = options.map(o => o.trim()).filter(o => o !== '');
		if (cleanOptions.length < 2) return toast({ title: 'Minimum 2 options', status: 'error' });

		try {
			await createMarket(
				question, 
				user.uid, 
				parseInt(betAmount) || 100, 
				selectedOption, 
				cleanOptions,
				taggedUser ? taggedUser : null
			);
			triggerHaptic();
			toast({ title: 'Contract Floated', status: 'success', duration: 2000 });
			setQuestion('');
			setBetAmount('100');
			setOptions(['YES', 'NO']);
			setSelectedOption('YES');
			setTaggedUser('');
			onClose();
		} catch (e: any) {
			toast({ title: 'Execution Error', description: e.message, status: 'error' });
		}
	};

	const isLoading = profileLoading || marketsLoading;
	const activeMarkets = (markets || []).filter(m => {
		if (!m || m.status !== 'open') return false;
		if (filter === 'all') return true;
		return m.taggedUserId === filter;
	});

	const handleRefresh = useCallback(async () => {
		await new Promise(r => setTimeout(r, 400));
	}, []);

	return (
		<PullToRefresh onRefresh={handleRefresh}>
		<Box pb={8}>
			<TutorialWizard 
				pageKey="casino" 
				steps={[
					{
						title: "Pure Prediction",
						body: "Float contracts on anything from 'Will Jack clean the fridge?' to 'Who will win Game Night?'.",
						icon: IoStatsChartOutline
					},
					{
						title: "Targeted Analytics",
						body: "Use the roommate dock to filter markets by specific people in the house.",
						icon: IoSearchOutline
					},
					{
						title: "Impartial Judgement",
						body: "Markets no longer settle instantly. A random housemate with zero bets is chosen to verify the outcome, ensuring fair payouts.",
						icon: IoCheckmarkCircleOutline
					}
				]} 
			/>

			<Box px={4} pt={6} maxW='600px' mx='auto'>
				<Flex justify='space-between' align='center' mb={4}>
					<Box>
						<Text fontSize='2xl' fontWeight='900' color='textPrimary' fontFamily='Hellix'>
							House Casino
						</Text>
						<Text color='textSecondary' fontSize='sm' mt={1}>
							Predict your roommates' behavior.
						</Text>
					</Box>

					<Box>
						<Button 
							size='sm' 
							leftIcon={<Icon as={IoGameControllerOutline} />} 
							colorScheme='purple' 
							variant='solid' 
							borderRadius='12px' 
							onClick={() => { navigate('/casino/games'); triggerHaptic(); }}
							boxShadow='0 4px 14px 0 rgba(128, 90, 213, 0.39)'
						>
							Games
						</Button>
					</Box>
				</Flex>

				<DailySpin />

				<HStack overflowX='auto' pb={4} mb={2} spacing={3} sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
					<VStack spacing={1} cursor='pointer' onClick={() => { setFilter('all'); triggerHaptic(); }} opacity={filter === 'all' ? 1 : 0.5}>
						<Flex w='48px' h='48px' borderRadius='full' bg='surfaceDeep' border='2px solid' borderColor={filter === 'all' ? 'primaryAction' : 'border'} align='center' justify='center'>
							<Text fontSize='xs' fontWeight='900' color='textPrimary'>ALL</Text>
						</Flex>
						<Text fontSize='10px' fontWeight='700' color='textPrimary'>Market</Text>
					</VStack>

					{(roommates || []).map((r) => (
						<VStack key={r.id} spacing={1} cursor='pointer' onClick={() => { setFilter(r.id); triggerHaptic(); }} opacity={filter === r.id ? 1 : 0.4} transition='opacity 0.2s'>
							<Avatar size='md' name={r.displayName} bg={r.color} color='white' border={filter === r.id ? '2px solid' : 'none'} borderColor='primaryAction' />
							<Text fontSize='10px' fontWeight='700' color='textPrimary'>
								{r.id === user?.uid ? 'You' : (r.displayName?.split(' ')[0] || 'User')}
							</Text>
						</VStack>
					))}
				</HStack>
				
				{isLoading ? (
					<VStack spacing={4}>
						<Skeleton h='250px' borderRadius='16px' />
						<Skeleton h='250px' borderRadius='16px' />
					</VStack>
				) : activeMarkets.length === 0 ? (
					<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={8} textAlign='center'>
						<Text color='textSecondary' fontWeight='500'>No active contracts here.</Text>
					</Box>
				) : (
					<VStack spacing={4} align='stretch'>
						{activeMarkets.map((m) => <MarketCard key={m.id} market={m} />)}
					</VStack>
				)}
			</Box>


		</Box>
		</PullToRefresh>
	);
};

export default CasinoPage;
