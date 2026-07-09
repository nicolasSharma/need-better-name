import { useState, useEffect, useCallback } from 'react';
import {
	Box, Flex, Text, VStack, HStack, Button, Heading,
	useToast, Badge, IconButton
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoArrowBack, IoHandLeft, IoTrashOutline } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playCardFlip, playWin, playThump } from '@/lib/audio';
import Confetti from '@/components/Confetti';
import { useLobby, Chip, LobbyDock, CardUI, getChipForBet } from './shared';

const Blackjack = ({ onExit, balance }: { onExit: () => void, balance: number }) => {
	const { user } = useAuth();
	const { players, toggleReady, isMultiplayer, allReady, myReady } = useLobby('blackjack');
	const toast = useToast();
	const [deck, setDeck] = useState<any[]>([]);
	const [playerHand, setPlayerHand] = useState<any[]>([]);
	const [dealerHand, setDealerHand] = useState<any[]>([]);
	const [gameState, setGameState] = useState<'betting' | 'playing' | 'dealer-turn' | 'result'>('betting');
	const [bet, setBet] = useState(0);
	const [resultText, setResultText] = useState('');
	const [confetti, setConfetti] = useState(false);


	const getCardValue = (rank: string): number => {
		if (['J', 'Q', 'K'].includes(rank)) return 10;
		if (rank === 'A') return 11;
		return parseInt(rank);
	};

	const calculateHand = (hand: any[]) => {
		let total = hand.reduce((acc, card) => acc + getCardValue(card.rank), 0);
		let aces = hand.filter(c => c.rank === 'A').length;
		while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
		return total;
	};

	const startNewGame = async () => {
		if (balance < bet) { toast({ title: 'Insufficient BT', status: 'error' }); return; }
		if (isMultiplayer && !allReady) { toast({ title: 'Waiting for players', status: 'info' }); return; }
		const suits = ['H', 'D', 'C', 'S'];
		const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
		const newDeck = suits.flatMap(s => ranks.map(r => ({ suit: s, rank: r }))).sort(() => Math.random() - 0.5);
		const p1 = newDeck.pop()!, d1 = newDeck.pop()!, p2 = newDeck.pop()!, d2 = newDeck.pop()!;
		setDeck(newDeck); setPlayerHand([p1, p2]); setDealerHand([d1, d2]);
		setGameState('playing'); setResultText(''); setConfetti(false);
		triggerHaptic(); playCardFlip();
		if (calculateHand([p1, p2]) === 21) handleEndGame('blackjack');
	};

	const handleEndGame = useCallback(async (type: 'win' | 'loss' | 'push' | 'blackjack', overrideBet?: number) => {
		const currentBet = overrideBet ?? bet;
		let payout = 0;
		let message = '';

		if (type === 'win') {
			payout = currentBet * 2;
			message = `YOU WON ${payout} BT!`;
			playWin();
			setConfetti(true);
		} else if (type === 'blackjack') {
			payout = Math.floor(currentBet * 2.5); // 3:2 payout
			message = `BLACKJACK! ${payout} BT`;
			playWin();
			setConfetti(true);
		} else if (type === 'push') {
			payout = currentBet;
			message = 'PUSH (TIE)';
			playThump();
		} else {
			payout = 0;
			message = 'DEALER WINS';
			playThump();
		}

		setResultText(message);
		setGameState('result');
		await playCasinoGame(user!.uid, currentBet, payout, 'blackjack', `Blackjack: ${message}`);
	}, [user, bet]);

	useEffect(() => {
		if (gameState === 'dealer-turn') {
			const dealerPlay = async () => {
				let curDealer = [...dealerHand], curDeck = [...deck];
				while (calculateHand(curDealer) < 17) {
					await new Promise(r => setTimeout(r, 600));
					curDealer.push(curDeck.pop()!);
					setDealerHand([...curDealer]); setDeck([...curDeck]); playCardFlip();
				}
				const pTot = calculateHand(playerHand), dTot = calculateHand(curDealer);
				if (dTot > 21 || pTot > dTot) handleEndGame('win');
				else if (pTot === dTot) handleEndGame('push');
				else handleEndGame('loss');
			};
			dealerPlay();
		}
	}, [gameState, dealerHand, deck, playerHand, handleEndGame]);

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)'>
			<VStack spacing={8} w='100%' flex={1}>
				<Confetti fire={confetti} />
				<Flex w='100%' justify='space-between' align='center'>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}>
						<Heading size='sm' color='textPrimary'>Blackjack</Heading>
						<LobbyDock players={players} userId={user?.uid} onToggleReady={toggleReady} />
					</VStack>
					<Box w='40px' />
				</Flex>

				<VStack spacing={10} py={10}>
					<VStack position='relative'>
						<Text fontSize='10px' fontWeight='900' color='textSecondary'>DEALER</Text>
						<HStack spacing={-10}>
							{dealerHand.map((c, i) => (
								<CardUI key={i} card={c} hidden={gameState === 'playing' && i === 1} index={i} />
							))}
						</HStack>
						{/* DECK OF CARDS */}
						<Box position='absolute' left='-100px' top='20px' display={{ base: 'none', md: 'block' }}>
							{Array.from({length: 5}).map((_, i) => (
								<Box key={i} position='absolute' top={`${i * -2}px`} left={`${i * -2}px`}>
									<CardUI card={{rank: '?', suit: 'H'}} hidden={true} index={0} />
								</Box>
							))}
						</Box>
					</VStack>

					<AnimatePresence>
						{gameState === 'result' && (
							<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
								<Badge colorScheme='yellow' fontSize='2xl' p={3} borderRadius='xl'>{resultText}</Badge>
							</motion.div>
						)}
						{(gameState === 'betting' || gameState === 'playing' || gameState === 'dealer-turn') && bet > 0 && (
							<VStack spacing={1} as={motion.div} initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
								<Chip amount={getChipForBet(bet)} active={true} onClick={()=>{}} />
								<Badge variant='outline' colorScheme='yellow' borderRadius='full' px={3}>{bet} BT</Badge>
							</VStack>
						)}
					</AnimatePresence>

					<VStack>
						<HStack spacing={-10}>
							{playerHand.map((c, i) => (
								<CardUI key={i} card={c} index={i + 2} />
							))}
						</HStack>
						<Badge colorScheme='blue' mt={2}>{calculateHand(playerHand)}</Badge>
						<Text fontSize='10px' fontWeight='900' color='textSecondary'>PLAYER</Text>
					</VStack>
				</VStack>
			</VStack>

			<Box w='100%' pt={8}>
				{gameState === 'betting' || gameState === 'result' ? (
					<VStack w='100%'>
						<HStack w='100%' justify='center' spacing={4} mb={6}>
							{[10, 50, 100, 500, 1000].map(amt => (
								<Chip key={amt} amount={amt} active={false} onClick={() => { setBet(prev => prev + amt); triggerHaptic(); }} />
							))}
							<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='textSecondary' onClick={() => setBet(0)} aria-label='clear' />
						</HStack>
						{isMultiplayer && !allReady && (
							<Button w='100%' h='50px' variant='ghost' colorScheme={myReady ? 'green' : 'yellow'} onClick={() => toggleReady(!myReady)} mb={2}>
								{myReady ? 'READY!' : 'READY UP'}
							</Button>
						)}
						<Button 
							w='100%' h='60px' colorScheme='green' 
							borderRadius='20px'
							fontSize='xl' fontWeight='900'
							onClick={startNewGame}
							isDisabled={bet === 0 || (isMultiplayer && !allReady)}
							boxShadow='0 10px 20px rgba(0, 200, 83, 0.3)'
						>
							DEAL {bet > 0 ? `${bet} BT` : ''}
						</Button>
					</VStack>
				) : (
					<VStack w='100%' spacing={3}>
						<HStack w='100%' spacing={4}>
							<Button flex={1} h='60px' bg='gray.600' color='white' _hover={{ bg: 'gray.700' }} borderRadius='20px' fontSize='lg' fontWeight='900' onClick={() => { setGameState('dealer-turn'); triggerHaptic(); }} isDisabled={gameState !== 'playing'}>STAND</Button>
							<Button flex={1} h='60px' bg='blue.500' color='white' borderRadius='20px' fontSize='lg' fontWeight='900' onClick={() => { 
								const nc = [...deck]; const c = nc.pop()!; const nh = [...playerHand, c];
								setDeck(nc); setPlayerHand(nh); playCardFlip();
								if (calculateHand(nh) > 21) handleEndGame('loss');
							}} isDisabled={gameState !== 'playing'}>HIT</Button>
						</HStack>
						{[9, 10, 11].includes(calculateHand(playerHand)) && playerHand.length === 2 && balance >= bet * 2 && (
							<Button 
								w='100%' h='50px' variant='outline' colorScheme='yellow' border='2px solid' borderRadius='20px'
								onClick={() => {
									const nc = [...deck]; const c = nc.pop()!; const nh = [...playerHand, c];
									const finalBet = bet * 2;
									setDeck(nc); setPlayerHand(nh); setBet(finalBet);
									playCardFlip();
									// Dealer turn logic check
									if (calculateHand(nh) > 21) handleEndGame('loss', finalBet);
									else setGameState('dealer-turn');
								}}
							>
								DOUBLE DOWN ({bet * 2} BT)
							</Button>
						)}
					</VStack>
				)}
			</Box>
		</Flex>
	);
};

export default Blackjack;
