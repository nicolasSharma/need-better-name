import { useState } from 'react';
import { Box, Flex, Text, VStack, HStack, Button, Heading, useToast, Badge, Icon, IconButton } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { IoArrowBack, IoFlash, IoTrashOutline } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playCardFlip, playThump, playChime } from '@/lib/audio';
import { useLobby, Chip, LobbyDock, CardUI } from './shared';

const HigherLower = ({ onExit, balance }: { onExit: () => void; balance: number }) => {
	const { user } = useAuth();
	const { players } = useLobby('highlow');
	const toast = useToast();
	const [streak, setStreak] = useState(0);
	const suits = ['H', 'D', 'C', 'S'];
	const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
	const getNewCard = () => { const r = ranks[Math.floor(Math.random() * ranks.length)]; const s = suits[Math.floor(Math.random() * suits.length)]; return { rank: r, suit: s, value: ranks.indexOf(r) + 1 }; };
	const [currentCard, setCurrentCard] = useState(getNewCard());
	const [nextCard, setNextCard] = useState<any>(null);
	const [bet, setBet] = useState(50);
	const [active, setActive] = useState(false);

	const play = async (guess: 'higher' | 'lower') => {
		if (!active) { if (balance < bet) { toast({ title: 'Insufficient BT', status: 'error' }); return; } setActive(true); }
		const next = getNewCard(); setNextCard(next); triggerHaptic(); playCardFlip();
		const won = (guess === 'higher' && next.value >= currentCard.value) || (guess === 'lower' && next.value <= currentCard.value);
		if (won) { playChime(); setStreak(s => s + 1); setTimeout(() => { setCurrentCard(next); setNextCard(null); }, 1000); }
		else {
			playThump();
			const mults = [0, 1.2, 1.5, 2, 3, 5, 10, 25];
			const finalMult = mults[Math.min(streak, mults.length - 1)];
			const payout = Math.floor(bet * finalMult);
			await playCasinoGame(user!.uid, bet, payout, 'streak', `High/Low Streak: ${streak}x (${payout} BT)`);
			setActive(false); setStreak(0);
			setTimeout(() => { setCurrentCard(getNewCard()); setNextCard(null); }, 1500);
		}
	};

	const handleCashOut = async () => {
		if (!active || streak === 0) return;
		triggerHaptic();
		playChime();
		const mults = [0, 1.2, 1.5, 2, 3, 5, 10, 25];
		const finalMult = mults[Math.min(streak, mults.length - 1)];
		const payout = Math.floor(bet * finalMult);
		await playCasinoGame(user!.uid, bet, payout, 'streak', `High/Low Cashout: ${streak}x (${payout} BT)`);
		setActive(false); setStreak(0);
		setCurrentCard(getNewCard()); setNextCard(null);
	};

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)'>
			<VStack spacing={8} w='100%' flex={1}>
				<Flex w='100%' justify='space-between' align='center'>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}><Heading size='sm' color='textPrimary'>High / Low</Heading><LobbyDock players={players} /></VStack>
					<Box w='40px' />
				</Flex>
				<VStack spacing={0}>
					<Text color='yellow.400' fontWeight='900' fontSize='xs'>STREAK MULTIPLIER</Text>
					<Heading size='5xl' color='textPrimary' fontWeight='900'>{streak}x</Heading>
					{bet > 0 && (<VStack mt={4} as={motion.div} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><Chip amount={bet > 500 ? 500 : 50} active={true} onClick={() => {}} /><Badge variant='outline' colorScheme='yellow' borderRadius='full' px={3}>{bet} BT</Badge></VStack>)}
				</VStack>
				<HStack spacing={10} align='center'>
					<CardUI card={currentCard} index={0} />
					<Icon as={IoFlash} color='yellow.400' w={8} h={8} />
					<Box position='relative'>
						{nextCard ? <CardUI card={nextCard} index={1} /> : (
							<Box w='85px' h='120px' bg='whiteAlpha.100' border='2px dashed' borderColor='whiteAlpha.300' borderRadius='xl' display='flex' align='center' justify='center'>
								<Text fontSize='4xl' fontWeight='900' color='white'>?</Text>
							</Box>
						)}
					</Box>
				</HStack>
			</VStack>
			<Box w='100%' pt={10}>
				<VStack w='100%'>
					{!active && (<HStack w='100%' justify='center' spacing={4} mb={6}>{[10, 50, 100, 500].map(amt => (<Chip key={amt} amount={amt} active={false} onClick={() => { setBet(prev => prev + amt); triggerHaptic(); }} />))}<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='textSecondary' onClick={() => setBet(0)} aria-label='clear' /></HStack>)}
					<HStack w='100%' spacing={4}>
						<Button flex={1} h='60px' bg='blue.500' color='white' borderRadius='20px' fontSize='xl' fontWeight='900' onClick={() => play('higher')}>HIGHER</Button>
						<Button flex={1} h='60px' bg='red.500' color='white' borderRadius='20px' fontSize='xl' fontWeight='900' onClick={() => play('lower')}>LOWER</Button>
					</HStack>
					{active && streak >= 1 && (
						<Button
							w='100%'
							h='50px'
							mt={3}
							colorScheme='green'
							borderRadius='20px'
							fontSize='lg'
							fontWeight='900'
							onClick={handleCashOut}
						>
							CASH OUT ({(bet * [0, 1.2, 1.5, 2, 3, 5, 10, 25][Math.min(streak, 7)]).toFixed(0)} BT)
						</Button>
					)}
				</VStack>
			</Box>
		</Flex>
	);
};

export default HigherLower;
