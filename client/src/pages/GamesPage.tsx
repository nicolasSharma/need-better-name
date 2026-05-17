import { useState, useEffect, useCallback, useRef } from 'react';
import { 
	Box, Flex, Text, VStack, HStack, Button, Heading, Icon, 
	useToast, Container, Badge, Center, Grid, GridItem,
	IconButton, SimpleGrid, ScaleFade, Image, Avatar
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
	IoArrowBack, IoPlay, IoHandLeft, IoAddCircle, 
	IoDice, IoTime, IoTrophy, IoChevronForward,
	IoInfinite, IoFlash, IoFitness, IoBarbell, IoTrashOutline, IoRocketOutline
} from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { playCasinoGame } from '@/lib/firestore';
import { triggerHaptic } from '@/lib/haptics';
import { playCardFlip, playWin, playThump, playPlink, playChime } from '@/lib/audio';
import Confetti from '@/components/Confetti';
import { doc, setDoc, onSnapshot, serverTimestamp, deleteField, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

// --- LOBBY SYSTEM ---
const useLobby = (gameId: string) => {
	const { user } = useAuth();
	const { profile } = useUser();
	const [players, setPlayers] = useState<any[]>([]);

	useEffect(() => {
		if (!user || !gameId) return;

		const lobbyRef = doc(db, 'lobbies', gameId);
		
		// Join Lobby
		setDoc(lobbyRef, {
			[`players.${user.uid}`]: {
				id: user.uid,
				displayName: profile?.displayName || 'User',
				photoURL: user.photoURL,
				lastActive: serverTimestamp(),
				ready: false
			}
		}, { merge: true });

		// Listen to Lobby
		const unsub = onSnapshot(lobbyRef, (snap) => {
			if (!snap.exists()) return;
			const data = snap.data();
			const allPlayers = Object.values(data.players || {});
			const now = Date.now();
			const active = allPlayers.filter((p: any) => {
				const last = p.lastActive?.toMillis() || now;
				return now - last < 30000;
			});
			setPlayers(active);
		});

		// Pulse Presence
		const interval = setInterval(() => {
			updateDoc(lobbyRef, {
				[`players.${user.uid}.lastActive`]: serverTimestamp()
			});
		}, 15000);

		return () => {
			unsub();
			clearInterval(interval);
			updateDoc(lobbyRef, {
				[`players.${user.uid}`]: deleteField()
			});
		};
	}, [user, gameId, profile?.displayName]);

	const toggleReady = (isReady: boolean) => {
		if (!user || !gameId) return;
		const lobbyRef = doc(db, 'lobbies', gameId);
		updateDoc(lobbyRef, {
			[`players.${user.uid}.ready`]: isReady
		});
	};

	const resetLobbyReady = () => {
		if (!user || !gameId) return;
		const lobbyRef = doc(db, 'lobbies', gameId);
		const updates: any = {};
		players.forEach(p => {
			updates[`players.${p.id}.ready`] = false;
		});
		updateDoc(lobbyRef, updates);
	};

	return { players, toggleReady, resetLobbyReady };
};

// --- CHIP COMPONENT ---
const Chip = ({ amount, active, onClick, disabled }: { amount: number, active: boolean, onClick: () => void, disabled?: boolean }) => {
	const colors: any = {
		10: { bg: 'white', text: 'black', border: 'gray.300' },
		50: { bg: 'blue.500', text: 'white', border: 'blue.300' },
		100: { bg: 'red.500', text: 'white', border: 'red.300' },
		500: { bg: 'purple.600', text: 'white', border: 'purple.400' },
		1000: { bg: 'black', text: 'white', border: 'yellow.500' }
	};
	const style = colors[amount] || colors[10];

	return (
		<VStack 
			spacing={0} cursor={disabled ? 'not-allowed' : 'pointer'} 
			onClick={() => !disabled && onClick()}
			as={motion.div} whileTap={disabled ? {} : { scale: 0.9 }}
			transition='0.2s'
		>
			<Flex 
				w='44px' h='44px' borderRadius='full' align='center' justify='center' 
				bg={style.bg} border='4px dashed' borderColor={style.border}
				boxShadow={active ? `0 0 15px ${style.bg}` : 'lg'}
				transform={active ? 'translateY(-5px) scale(1.1)' : 'none'}
				position='relative'
			>
				<Flex w='32px' h='32px' borderRadius='full' border='1px solid' borderColor={style.text} align='center' justify='center' bg='transparent'>
					<Text fontSize='10px' fontWeight='900' color={style.text}>{amount}</Text>
				</Flex>
			</Flex>
		</VStack>
	);
};

// --- LOBBY DOCK ---
const LobbyDock = ({ players, onToggleReady, userId }: { players: any[], onToggleReady?: (r: boolean) => void, userId?: string }) => (
	<HStack spacing={-2} bg='blackAlpha.400' p={1} borderRadius='full' pl={3} pr={3}>
		{players.slice(0, 5).map(p => (
			<Box key={p.id} position='relative'>
				<Avatar 
					size='xs' src={p.photoURL} name={p.displayName} 
					border='2px solid' borderColor={p.ready ? 'green.400' : 'gray.600'}
					filter={p.ready ? 'none' : 'grayscale(100%)'}
					onClick={() => p.id === userId && onToggleReady?.(!p.ready)}
					cursor={p.id === userId ? 'pointer' : 'default'}
				/>
				{p.ready && (
					<Box position='absolute' bottom='-2px' right='-2px' bg='green.400' w='6px' h='6px' borderRadius='full' border='1px solid' borderColor='bg' />
				)}
			</Box>
		))}
		{players.length > 5 && <Text fontSize='9px' fontWeight='900' color='whiteAlpha.600'>+{players.length - 5}</Text>}
		<Box w={2} />
		<Text fontSize='9px' fontWeight='900' color='green.400' letterSpacing='widest'>LIVE</Text>
	</HStack>
);

// --- BLACKJACK COMPONENT ---
// --- UTILS ---
const getChipForBet = (amount: number) => {
	if (amount >= 1000) return 1000;
	if (amount >= 500) return 500;
	if (amount >= 100) return 100;
	if (amount >= 50) return 50;
	return 10;
};

const HORSE_DATA = [
	{ id: 1, name: 'Midnight Thunder', color: 'gray.800', odds: 2.5, symbol: '🐎' },
	{ id: 2, name: 'Golden Gallop', color: 'yellow.500', odds: 5.0, symbol: '🏇' },
	{ id: 3, name: 'Desert Rose', color: 'orange.400', odds: 8.0, symbol: '🐎' },
	{ id: 4, name: 'Silver Streak', color: 'gray.400', odds: 15.0, symbol: '🏇' },
	{ id: 5, name: 'Blue Comet', color: 'blue.500', odds: 30.0, symbol: '🐎' },
	{ id: 6, name: 'Crimson King', color: 'red.600', odds: 60.0, symbol: '🏇' },
];

// (Ported from previous version)
const Blackjack = ({ onExit, balance }: { onExit: () => void, balance: number }) => {
	const { user } = useAuth();
	const players = useLobby('blackjack');
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
		const suits = ['H', 'D', 'C', 'S'];
		const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
		const newDeck = suits.flatMap(s => ranks.map(r => ({ suit: s, rank: r }))).sort(() => Math.random() - 0.5);
		const p1 = newDeck.pop()!, d1 = newDeck.pop()!, p2 = newDeck.pop()!, d2 = newDeck.pop()!;
		setDeck(newDeck); setPlayerHand([p1, p2]); setDealerHand([d1, d2]);
		setGameState('playing'); setResultText(''); setConfetti(false);
		triggerHaptic(); playCardFlip();
		if (calculateHand([p1, p2]) === 21) handleEndGame('blackjack');
	};

	const handleEndGame = useCallback(async (type: 'win' | 'loss' | 'push' | 'blackjack') => {
		let payout = 0;
		let message = '';

		if (type === 'win') {
			payout = bet * 2;
			message = `YOU WON ${payout} BT!`;
			playWin();
			setConfetti(true);
		} else if (type === 'blackjack') {
			payout = Math.floor(bet * 2.5); // 3:2 payout
			message = `BLACKJACK! ${payout} BT`;
			playWin();
			setConfetti(true);
		} else if (type === 'push') {
			payout = bet;
			message = 'PUSH (TIE)';
			playThump();
		} else {
			payout = 0;
			message = 'DEALER WINS';
			playThump();
		}

		setResultText(message);
		setGameState('result');
		await playCasinoGame(user!.uid, bet, payout, 'blackjack', `Blackjack: ${message}`);
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
		<VStack spacing={8} w='100%'>
			<Confetti fire={confetti} />
			<Flex w='100%' justify='space-between' align='center'>
				<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
				<VStack spacing={1}>
					<Heading size='sm' color='textPrimary'>Blackjack</Heading>
					<LobbyDock players={players} />
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

			<Box position='fixed' bottom='40px' left={6} right={6}>
				{gameState === 'betting' || gameState === 'result' ? (
					<VStack w='100%'>
						<HStack w='100%' justify='center' spacing={4} mb={6}>
							{[10, 50, 100, 500, 1000].map(amt => (
								<Chip key={amt} amount={amt} active={false} onClick={() => { setBet(prev => prev + amt); triggerHaptic(); }} />
							))}
							<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='textSecondary' onClick={() => setBet(0)} aria-label='clear' />
						</HStack>
						<Button 
							w='100%' h='60px' colorScheme='green' 
							borderRadius='20px'
							fontSize='xl' fontWeight='900'
							onClick={startNewGame}
							isDisabled={bet === 0}
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
									if (calculateHand(nh) > 21) handleEndGame('loss');
									else setGameState('dealer-turn');
								}}
							>
								DOUBLE DOWN ({bet * 2} BT)
							</Button>
						)}
					</VStack>
				)}
			</Box>
		</VStack>
	);
};

// --- ROULETTE COMPONENT ---
const Roulette = ({ onExit, balance }: { onExit: () => void, balance: number }) => {
	const { user } = useAuth();
	const { players, toggleReady, resetLobbyReady } = useLobby('roulette');
	const toast = useToast();
	const [spinning, setSpinning] = useState(false);
	const [result, setResult] = useState<number | null>(null);
	const [activeChip, setActiveChip] = useState(50);
	const [bets, setBets] = useState<Record<string, number>>({});
	const [rotation, setRotation] = useState(0);
	const [resultText, setResultText] = useState('');
	const [confetti, setConfetti] = useState(false);

	const isMultiplayer = players.length > 1;
	const allReady = !isMultiplayer || players.every(p => p.ready);
	const isReady = players.find(p => p.id === user?.uid)?.ready || false;
	const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

	const spin = async () => {
		if (spinning || totalBet === 0 || balance < totalBet || !allReady) return;
		setSpinning(true);
		setResult(null);
		setResultText('');
		setConfetti(false);
		triggerHaptic();
		playPlink();
		
		resetLobbyReady(); // Clear ready state for next round
		
		const sequence = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
		const targetNum = sequence[Math.floor(Math.random() * sequence.length)];
		const targetIdx = sequence.indexOf(targetNum);
		const extraSpins = 4 + Math.floor(Math.random() * 2);
		const finalRot = (extraSpins * 360) + (targetIdx * (360/37)) + (360/74);
		
		setRotation(finalRot);
	};

	const resolveSpin = async () => {
		if (!spinning) return;
		
		const sequence = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
		const targetIdx = Math.round((rotation % 360) / (360/37)) % 37;
		const targetNum = sequence[targetIdx];
		
		setResult(targetNum);
		setSpinning(false);

		let totalPayout = 0;
		if (bets['green'] && targetNum === 0) totalPayout += bets['green'] * 35;
		if (bets['red'] && [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(targetNum)) totalPayout += bets['red'] * 2;
		if (bets['black'] && ![0, 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(targetNum) && targetNum !== 0) totalPayout += bets['black'] * 2;
		
		Object.keys(bets).forEach(key => {
			if (key.startsWith('num_')) {
				const n = parseInt(key.split('_')[1]);
				if (n === targetNum) totalPayout += bets[key] * 35;
			}
		});

		if (totalPayout > 0) {
			setResultText(`YOU WON ${totalPayout} BT!`);
			setConfetti(true);
			playWin();
		} else {
			setResultText('YOU LOST');
			playThump();
		}
		
		await playCasinoGame(user!.uid, totalBet, totalPayout, 'roulette', `Roulette: Landed ${targetNum} (${totalPayout > 0 ? 'WON' : 'LOST'})`);
	};

	const placeBet = (key: string) => {
		if (spinning) return;
		triggerHaptic();
		playPlink();
		setBets(prev => ({
			...prev,
			[key]: (prev[key] || 0) + activeChip
		}));
	};

	return (
		<VStack spacing={6} w='100%'>
			<Confetti fire={confetti} />
			<Flex w='100%' justify='space-between' align='center'>
				<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
				<VStack spacing={1}>
					<Heading size='sm' color='textPrimary'>Roulette Table</Heading>
					<LobbyDock players={players} userId={user?.uid} onToggleReady={toggleReady} />
				</VStack>
				<Box w='40px' />
			</Flex>

			<Center h='300px' w='300px' position='relative'>
				{/* MAIN WHEEL */}
				<Box 
					as={motion.div} 
					animate={{ rotate: -rotation }} 
					transition={{ duration: 10, ease: [0.15, 0, 0.15, 1] }}
					onAnimationComplete={resolveSpin}
					w='260px' h='260px' borderRadius='full' 
					border='12px solid #3d2b1f'
					position='relative' overflow='hidden'
					boxShadow='dark-lg'
					style={{
						background: `conic-gradient(
							#00a65a 0deg 9.73deg,
							#d32f2f 9.73deg 19.46deg, #000 19.46deg 29.19deg, #d32f2f 29.19deg 38.92deg, #000 38.92deg 48.65deg,
							#d32f2f 48.65deg 58.38deg, #000 58.38deg 68.11deg, #d32f2f 68.11deg 77.84deg, #000 77.84deg 87.57deg,
							#d32f2f 87.57deg 97.3deg, #000 97.3deg 107.03deg, #d32f2f 107.03deg 116.76deg, #000 116.76deg 126.49deg,
							#d32f2f 126.49deg 136.22deg, #000 136.22deg 145.95deg, #d32f2f 145.95deg 155.68deg, #000 155.68deg 165.41deg,
							#d32f2f 165.41deg 175.14deg, #000 175.14deg 184.87deg, #d32f2f 184.87deg 194.6deg, #000 194.6deg 204.33deg,
							#d32f2f 204.33deg 214.06deg, #000 214.06deg 223.79deg, #d32f2f 223.79deg 233.52deg, #000 233.52deg 243.25deg,
							#d32f2f 243.25deg 252.98deg, #000 252.98deg 262.71deg, #d32f2f 262.71deg 272.44deg, #000 272.44deg 282.17deg,
							#d32f2f 282.17deg 291.9deg, #000 291.9deg 301.63deg, #d32f2f 301.63deg 311.36deg, #000 311.36deg 321.09deg,
							#d32f2f 321.09deg 330.82deg, #000 330.82deg 340.55deg, #d32f2f 340.55deg 350.28deg, #000 350.28deg 360deg
						)`
					}}
				>
					{[0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26].map((n, i) => (
						<Box 
							key={i} position='absolute' top='50%' left='50%' w='1px' h='122px'
							transform={`translate(-50%, -100%) rotate(${i * (360/37) + (360/74)}deg)`}
							transformOrigin='bottom center'
						>
							<Text 
								color='white' fontSize='8.5px' fontWeight='900' textAlign='center' 
								mt={0.5} filter='drop-shadow(0 0 1px black)' whiteSpace='nowrap'
								transform='translateX(-50%)' position='absolute' left='50%'
							>
								{n}
							</Text>
						</Box>
					))}
					<Box position='absolute' top='50%' left='50%' transform='translate(-50%,-50%)' w='80px' h='80px' bgGradient='radial(#D4AF37, #8a6d3b)' borderRadius='full' border='6px solid #3d2b1f' boxShadow='inner' />
				</Box>

				{/* Indicator Pointer */}
				<Box position='absolute' top='15px' left='50%' transform='translateX(-50%)' w='0' h='0' borderLeft='10px solid transparent' borderRight='10px solid transparent' borderTop='20px solid #D4AF37' zIndex={10} filter='drop-shadow(0 2px 4px rgba(0,0,0,0.5))' />
			</Center>

			{/* Roulette Table Grid */}
			<Box w='100%' bg='green.800' p={4} borderRadius='12px' border='4px solid' borderColor='#D4AF37' boxShadow='2xl' position='relative'>
				<HStack spacing={0} h='180px'>
					{/* 0 Green */}
					<Flex 
						w='40px' h='100%' bg='green.500' border='1px solid white' align='center' justify='center' 
						onClick={() => placeBet('green')} cursor='pointer' position='relative'
						borderTopLeftRadius='xl' borderBottomLeftRadius='xl'
						bgGradient={result === 0 ? 'radial(whiteAlpha.400, transparent)' : 'none'}
						borderColor={result === 0 ? 'yellow.400' : 'whiteAlpha.400'}
						borderWidth={result === 0 ? '3px' : '1px'}
					>
						<Text color='white' fontWeight='900' transform='rotate(-90deg)'>0</Text>
						{bets['green'] && <Box position='absolute' top='50%' left='50%' transform='translate(-50%,-50%)'><Chip amount={getChipForBet(bets['green'])} active={false} onClick={()=>{}} /></Box>}
					</Flex>

					{/* Numbers Grid (3 rows, 12 columns) */}
					<Grid templateRows='repeat(3, 1fr)' templateColumns='repeat(12, 1fr)' flex={1} h='100%'>
						{Array.from({length: 36}).map((_, i) => {
							// Roulette table numbers are usually laid out:
							// Row 1: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
							// Row 2: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
							// Row 3: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
							const col = Math.floor(i / 3);
							const row = 2 - (i % 3);
							const num = (col * 3) + (i % 3) + 1;
							
							const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num);
							const isWinner = result === num;

							return (
								<GridItem key={num} border='1px solid' borderColor='whiteAlpha.400'>
									<Flex 
										h='100%' bg={isRed ? 'red.600' : 'black'} align='center' justify='center' 
										onClick={() => placeBet(`num_${num}`)} cursor='pointer' position='relative'
										bgGradient={isWinner ? 'radial(whiteAlpha.600, transparent)' : 'none'}
										borderColor={isWinner ? 'yellow.400' : 'whiteAlpha.400'}
										borderWidth={isWinner ? '3px' : '1px'}
										transition='0.3s'
									>
										<Text color='white' fontSize='xs' fontWeight='900'>{num}</Text>
										{bets[`num_${num}`] && (
											<Box position='absolute' top='50%' left='50%' transform='translate(-50%,-50%) scale(0.6)'>
												<Chip amount={getChipForBet(bets[`num_${num}`])} active={false} onClick={()=>{}} />
											</Box>
										)}
									</Flex>
								</GridItem>
							);
						})}
					</Grid>
				</HStack>
				
				<HStack mt={4} spacing={2}>
					<Button flex={1} h='50px' bg='red.600' color='white' _hover={{bg: 'red.700'}} onClick={() => placeBet('red')} position='relative' borderRadius='xl'>
						RED (2x)
						{bets['red'] && <Box position='absolute' top='-10px' right='-10px' transform='scale(0.5)'><Chip amount={getChipForBet(bets['red'])} active={false} onClick={()=>{}}/></Box>}
					</Button>
					<Button flex={1} h='50px' bg='black' color='white' _hover={{bg: 'gray.900'}} onClick={() => placeBet('black')} position='relative' borderRadius='xl' border='1px solid' borderColor='whiteAlpha.300'>
						BLACK (2x)
						{bets['black'] && <Box position='absolute' top='-10px' right='-10px' transform='scale(0.5)'><Chip amount={getChipForBet(bets['black'])} active={false} onClick={()=>{}}/></Box>}
					</Button>
				</HStack>

				{/* Result Overlay */}
				<AnimatePresence>
					{result !== null && !spinning && (
						<Box 
							as={motion.div} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
							position='absolute' top='50%' left='50%' transform='translate(-50%, -50%)' zIndex={10}
							textAlign='center' pointerEvents='none'
						>
							<Badge colorScheme={resultText.includes('WON') ? 'green' : 'red'} fontSize='3xl' p={6} borderRadius='2xl' boxShadow='dark-lg' border='4px solid white'>
								{resultText}
							</Badge>
						</Box>
					)}
				</AnimatePresence>
			</Box>

			<Box position='fixed' bottom='40px' left={6} right={6}>
				<VStack w='100%'>
					<HStack w='100%' justify='center' spacing={4} mb={6}>
						{[10, 50, 100, 500].map(amt => (
							<Chip key={amt} amount={amt} active={activeChip === amt} onClick={() => { setActiveChip(amt); triggerHaptic(); }} />
						))}
						<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='whiteAlpha.600' onClick={() => setBets({})} aria-label='clear' />
					</HStack>
					<Button 
						w='100%' h='60px' colorScheme={allReady ? 'green' : 'gray'} size='lg' fontSize='xl' fontWeight='900' 
						isDisabled={spinning || totalBet === 0 || !allReady} onClick={spin}
						borderRadius='24px'
						boxShadow={allReady ? '0 10px 20px rgba(56, 161, 105, 0.3)' : 'none'}
						_active={{ transform: 'scale(0.98)' }}
					>
						{isMultiplayer && !allReady ? 'WAITING FOR PLAYERS...' : 'SPIN WHEEL'}
					</Button>
					{isMultiplayer && !allReady && (
						<Button w='100%' variant='ghost' colorScheme={isReady ? 'green' : 'yellow'} onClick={() => toggleReady(!isReady)}>
							{isReady ? 'READY!' : 'READY UP'}
						</Button>
					)}
				</VStack>
			</Box>
		</VStack>
	);
};

// --- HIGHER OR LOWER COMPONENT ---
const HigherLower = ({ onExit, balance }: { onExit: () => void, balance: number }) => {
	const { user } = useAuth();
	const players = useLobby('highlow');
	const toast = useToast();
	const [streak, setStreak] = useState(0);
	const [currentCard, setCurrentCard] = useState({ rank: '7', suit: 'H', value: 7 });
	const [nextCard, setNextCard] = useState<any>(null);
	const [bet, setBet] = useState(50);
	const [active, setActive] = useState(false);

	const suits = ['H', 'D', 'C', 'S'];
	const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

	const getNewCard = () => {
		const r = ranks[Math.floor(Math.random() * ranks.length)];
		const s = suits[Math.floor(Math.random() * suits.length)];
		const val = ranks.indexOf(r) + 1;
		return { rank: r, suit: s, value: val };
	};

	const play = async (guess: 'higher' | 'lower') => {
		if (!active) {
			if (balance < bet) { toast({ title: 'Insufficient BT', status: 'error' }); return; }
			setActive(true);
		}
		
		const next = getNewCard();
		setNextCard(next);
		triggerHaptic();
		playCardFlip();

		const won = (guess === 'higher' && next.value >= currentCard.value) || (guess === 'lower' && next.value <= currentCard.value);
		
		if (won) {
			playChime();
			setStreak(s => s + 1);
			setTimeout(() => {
				setCurrentCard(next);
				setNextCard(null);
			}, 1000);
		} else {
			playThump();
			const mults = [0, 1.2, 1.5, 2, 3, 5, 10, 25];
			const finalMult = mults[Math.min(streak, mults.length-1)];
			const payout = Math.floor(bet * finalMult);
			
			await playCasinoGame(user!.uid, bet, payout, 'streak', `High/Low Streak: ${streak}x (${payout} BT)`);
			setActive(false);
			setStreak(0);
			setTimeout(() => {
				setCurrentCard(getNewCard());
				setNextCard(null);
			}, 1500);
		}
	};

	return (
		<VStack spacing={8} w='100%'>
			<Flex w='100%' justify='space-between' align='center'>
				<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
				<VStack spacing={1}>
					<Heading size='sm' color='textPrimary'>High / Low</Heading>
					<LobbyDock players={players} />
				</VStack>
				<Box w='40px' />
			</Flex>

			<VStack spacing={0}>
				<Text color='yellow.400' fontWeight='900' fontSize='xs'>STREAK MULTIPLIER</Text>
				<Heading size='5xl' color='textPrimary' fontWeight='900'>{streak}x</Heading>
				{bet > 0 && (
					<VStack mt={4} as={motion.div} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
						<Chip amount={bet > 500 ? 500 : 50} active={true} onClick={()=>{}} />
						<Badge variant='outline' colorScheme='yellow' borderRadius='full' px={3}>{bet} BT</Badge>
					</VStack>
				)}
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

			<Box position='fixed' bottom='40px' left={6} right={6}>
				<VStack w='100%'>
					{!active && (
						<HStack w='100%' justify='center' spacing={4} mb={6}>
							{[10, 50, 100, 500].map(amt => (
								<Chip key={amt} amount={amt} active={false} onClick={() => { setBet(prev => prev + amt); triggerHaptic(); }} />
							))}
							<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='textSecondary' onClick={() => setBet(0)} aria-label='clear' />
						</HStack>
					)}
					<HStack w='100%' spacing={4}>
						<Button flex={1} h='60px' bg='blue.500' color='white' borderRadius='20px' fontSize='xl' fontWeight='900' onClick={() => play('higher')}>HIGHER</Button>
						<Button flex={1} h='60px' bg='red.500' color='white' borderRadius='20px' fontSize='xl' fontWeight='900' onClick={() => play('lower')}>LOWER</Button>
					</HStack>
				</VStack>
			</Box>
		</VStack>
	);
};

// --- GAMES HUB ---
const GamesPage = () => {
	const navigate = useNavigate();
	const { profile } = useUser();
	const [activeGame, setActiveGame] = useState<'none' | 'blackjack' | 'roulette' | 'streak' | 'horse'>('none');

	const games = [
		{ id: 'blackjack', name: 'Blackjack', icon: IoHandLeft, color: 'green.500', desc: 'Beat the dealer to 21' },
		{ id: 'roulette', name: 'Roulette', icon: IoDice, color: 'red.500', desc: 'Single-zero classic' },
		{ id: 'streak', name: 'High / Low', icon: IoInfinite, color: 'blue.500', desc: 'Build a streak multiplier' },
		{ id: 'horse', name: 'Horse Racing', icon: IoRocketOutline, color: 'green.500', desc: 'Real-time track simulation' },
	];

	if (activeGame !== 'none') {
		return (
			<Box minH='100vh' bg='bg' p={4} pt='env(safe-area-inset-top, 0px)'>
				{activeGame === 'blackjack' && <Blackjack onExit={() => setActiveGame('none')} balance={profile?.balance || 0} />}
				{activeGame === 'roulette' && <Roulette onExit={() => setActiveGame('none')} balance={profile?.balance || 0} />}
				{activeGame === 'streak' && <HigherLower onExit={() => setActiveGame('none')} balance={profile?.balance || 0} />}
				{activeGame === 'horse' && <HorseRacing onExit={() => setActiveGame('none')} balance={profile?.balance || 0} />}
			</Box>
		);
	}

	return (
		<Box minH='100vh' bg='bg' p={6} pt='env(safe-area-inset-top, 0px)'>
			<Flex justify='space-between' align='center' mb={10}>
				<IconButton icon={<IoArrowBack />} onClick={() => navigate('/casino')} variant='ghost' aria-label='back' />
			</Flex>

			<Heading color='textPrimary' size='2xl' fontWeight='900' mb={2} letterSpacing='tight'>Games Hub</Heading>
			<Text color='textSecondary' mb={10} fontSize='lg'>House-backed social gaming.</Text>

			<VStack spacing={4}>
				{games.map(game => (
					<Box 
						key={game.id}
						w='100%' 
						bg='surface' 
						p={6} 
						borderRadius='24px' 
						border='1px solid' 
						borderColor='border'
						onClick={() => { setActiveGame(game.id as any); triggerHaptic(); }}
						cursor='pointer'
						_active={{ scale: 0.98, opacity: 0.8 }}
						transition='all 0.2s'
						position='relative'
						overflow='hidden'
					>
						<Box position='absolute' top='-10%' right='-5%' opacity={0.05}>
							<Icon as={game.icon} w='100px' h='100px' color='textPrimary' />
						</Box>
						<HStack spacing={5}>
							<Flex w='56px' h='56px' bg={game.color} borderRadius='18px' align='center' justify='center' boxShadow='xl'>
								<Icon as={game.icon} w={7} h={7} color='white' />
							</Flex>
							<Box>
								<Text color='textPrimary' fontWeight='900' fontSize='xl'>{game.name}</Text>
								<Text color='textSecondary' fontSize='sm'>{game.desc}</Text>
							</Box>
							<Box flex={1} />
							<Icon as={IoChevronForward} color='textSecondary' />
						</HStack>
					</Box>
				))}
			<Box 
				w='100%' bg='surface' p={6} borderRadius='24px' border='1px dashed' borderColor='border' opacity={0.6} textAlign='center'
			>
				<Text color='textSecondary' fontSize='sm' fontWeight='800' letterSpacing='widest'>CRAPS COMING SOON</Text>
			</Box>
		</VStack>
	</Box>
);
};

// Internal Card Component
const CardUI = ({ card, hidden, index }: { card: any; hidden?: boolean; index: number }) => {
	const color = ['H', 'D'].includes(card.suit) ? '#FF3B30' : '#1C1C1E';
	const suitIcon = { H: '♥', D: '♦', C: '♣', S: '♠' }[card.suit];

	return (
		<Box
			as={motion.div}
			initial={{ y: -100, x: 50, rotate: 180, opacity: 0 }}
			animate={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
			transition={{ delay: index * 0.1, type: 'spring', damping: 20 }}
			w='85px' h='120px' bg='white' borderRadius='12px' boxShadow='2xl' display='flex' flexDir='column' justify='space-between' p={2}
			position='relative'
			border='1px solid' borderColor='gray.200'
		>
			{hidden ? (
				<Box w='100%' h='100%' bgGradient='linear(to-br, #2c3e50, #000000)' borderRadius='8px' border='4px solid' borderColor='whiteAlpha.400' display='flex' align='center' justify='center'>
					<Box w='80%' h='80%' border='1px solid' borderColor='whiteAlpha.300' borderRadius='4px' />
				</Box>
			) : (
				<>
					<Text fontWeight='900' fontSize='lg' color={color} lineHeight='1'>{card.rank}</Text>
					<Center flex={1}><Text fontSize='4xl' color={color}>{suitIcon}</Text></Center>
					<Text fontWeight='900' fontSize='lg' color={color} lineHeight='1' transform='rotate(180deg)'>{card.rank}</Text>
				</>
			)}
		</Box>
	);
};


// --- HORSE RACING COMPONENT ---
const HorseRacing = ({ onExit, balance }: { onExit: () => void, balance: number }) => {
	const { user } = useAuth();
	const { players, toggleReady, resetLobbyReady } = useLobby('horse_racing');
	const [gameState, setGameState] = useState<'betting' | 'racing' | 'finished'>('betting');
	const [activeChip, setActiveChip] = useState(50);
	const [bets, setBets] = useState<Record<string, number>>({});
	const [horsePositions, setHorsePositions] = useState<number[]>(HORSE_DATA.map(() => 0));
	const [results, setResults] = useState<any[]>([]);
	const [resultText, setResultText] = useState('');
	const [commentary, setCommentary] = useState('Welcome to the Grand Derby! Place your wagers.');
	const [confetti, setConfetti] = useState(false);
	const [leaderboard, setLeaderboard] = useState<any[]>(HORSE_DATA);

	const isMultiplayer = players.length > 1;
	const allReady = !isMultiplayer || players.every(p => p.ready);
	const isReady = players.find(p => p.id === user?.uid)?.ready || false;

	const requestRef = useRef<number>();
	const positionsRef = useRef<number[]>(HORSE_DATA.map(() => 0));
	const finishTimesRef = useRef<number[]>(HORSE_DATA.map(() => 0));

	const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

	const startRace = () => {
		if (gameState !== 'betting' || totalBet === 0 || balance < totalBet || !allReady) return;
		setGameState('racing');
		setResultText('');
		setConfetti(false);
		resetLobbyReady();
		positionsRef.current = HORSE_DATA.map(() => 0);
		finishTimesRef.current = HORSE_DATA.map(() => 0);
		requestRef.current = requestAnimationFrame(animate);
	};

	const animate = (time: number) => {
		let allFinished = true;
		const nextPositions = positionsRef.current.map((pos, i) => {
			if (pos >= 100) return 100;
			allFinished = false;
			// Base speed + random variation + sudden bursts
			const speed = 0.05 + Math.random() * 0.3 + (Math.random() > 0.98 ? 2.5 : 0); 
			const newPos = Math.min(100, pos + speed);
			if (newPos === 100 && finishTimesRef.current[i] === 0) finishTimesRef.current[i] = time;
			return newPos;
		});

		positionsRef.current = nextPositions;
		setHorsePositions([...nextPositions]);

		// Update Live Leaderboard & Commentary
		const currentRanks = HORSE_DATA.map((h, i) => ({ ...h, pos: nextPositions[i] }))
			.sort((a, b) => b.pos - a.pos);
		
		setLeaderboard(currentRanks);

		if (time % 100 < 20) { // Throttled commentary updates
			const lead = currentRanks[0];
			if (lead.pos < 20) setCommentary(`And they're off! ${lead.name} takes an early lead!`);
			else if (lead.pos < 50) setCommentary(`${lead.name} is looking strong at the quarter mark!`);
			else if (lead.pos < 80) setCommentary(`It's a tight race! ${currentRanks[1].name} is closing in on ${lead.name}!`);
			else if (lead.pos < 95) setCommentary(`Down the stretch they come! ${lead.name} is pulling away!`);
		}

		if (!allFinished) {
			requestRef.current = requestAnimationFrame(animate);
		} else {
			handleRaceEnd();
		}
	};

	const handleRaceEnd = async () => {
		const sorted = HORSE_DATA.map((h, i) => ({ ...h, finishTime: finishTimesRef.current[i] }))
			.sort((a, b) => a.finishTime - b.finishTime);
		
		setResults(sorted);
		setGameState('finished');

		const first = sorted[0];
		const second = sorted[1];
		const third = sorted[2];

		let totalPayout = 0;
		Object.entries(bets).forEach(([key, amt]) => {
			const [type, horseId] = key.split('_');
			const id = parseInt(horseId);

			if (type === 'win' && id === first.id) totalPayout += amt * first.odds;
			if (type === 'place' && (id === first.id || id === second.id)) totalPayout += amt * (first.odds * 0.6);
			if (type === 'show' && (id === first.id || id === second.id || id === third.id)) totalPayout += amt * (first.odds * 0.3);
		});

		if (totalPayout > 0) {
			setResultText(`WINNER: ${first.name}! YOU WON ${Math.floor(totalPayout)} BT!`);
			setConfetti(true);
			playWin();
		} else {
			setResultText(`WINNER: ${first.name}! NO LUCK THIS TIME.`);
			playThump();
		}

		await playCasinoGame(user!.uid, totalBet, Math.floor(totalPayout), 'horse_racing', `Horse Racing: 1st ${first.name}`);
	};

	const placeBet = (type: 'win' | 'place' | 'show', horseId: number) => {
		if (gameState !== 'betting') return;
		triggerHaptic();
		playPlink();
		const key = `${type}_${horseId}`;
		setBets(prev => ({ ...prev, [key]: (prev[key] || 0) + activeChip }));
	};

	return (
		<VStack spacing={6} w='100%' pb={10}>
			<Confetti fire={confetti} />
			<Flex w='100%' justify='space-between' align='center'>
				<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
				<VStack spacing={1}>
					<Heading size='sm' color='textPrimary'>Grand Derby</Heading>
					<LobbyDock players={players} userId={user?.uid} onToggleReady={toggleReady} />
				</VStack>
				<Box w='40px' />
			</Flex>

			{/* Racetrack */}
			<Box w='100%' bg='green.800' borderRadius='32px' border='8px solid' borderColor='yellow.700' boxShadow='2xl' position='relative' overflow='hidden' minH='400px' p={0}>
				{/* Turf Texture Overlay */}
				<Box position='absolute' inset={0} opacity={0.1} bgImage='url("https://www.transparenttextures.com/patterns/grass.png")' />
				
				{/* Finish Line Area */}
				<Box position='absolute' right='40px' top='0' bottom='0' w='60px' bg='whiteAlpha.100' display='flex' align='center' justify='center' borderLeft='4px solid white' borderRight='4px solid white'>
					<Box w='100%' h='100%' opacity={0.2} bgImage='url("https://www.transparenttextures.com/patterns/checkerboard.png")' />
				</Box>

				{/* Live Leaderboard Ticker */}
				<Box position='absolute' left={4} top={4} bg='blackAlpha.800' backdropFilter='blur(8px)' p={3} borderRadius='xl' border='1px solid' borderColor='whiteAlpha.200' zIndex={10}>
					<VStack spacing={1} align='start'>
						<Text fontSize='10px' fontWeight='900' color='yellow.400' letterSpacing='widest'>LEADERBOARD</Text>
						{leaderboard.slice(0, 3).map((h, i) => (
							<HStack key={h.id} spacing={2}>
								<Text fontSize='xs' fontWeight='900' color='whiteAlpha.600'>{i+1}</Text>
								<Box w={2} h={2} borderRadius='full' bg={h.color} />
								<Text fontSize='xs' fontWeight='900' color='white' noOfLines={1}>{h.name}</Text>
							</HStack>
						))}
					</VStack>
				</Box>

				{/* Commentary Bubble */}
				<Box position='absolute' bottom={4} left='50%' transform='translateX(-50%)' bg='blackAlpha.850' backdropFilter='blur(10px)' px={6} py={2} borderRadius='full' border='1px solid' borderColor='yellow.500' zIndex={10} minW='300px' textAlign='center'>
					<Text color='yellow.400' fontSize='xs' fontWeight='900' letterSpacing='tight' textTransform='uppercase'>{commentary}</Text>
				</Box>
				
				<VStack spacing={0} align='stretch' position='relative' zIndex={2} py={8}>
					{HORSE_DATA.map((h, i) => (
						<Box key={h.id} h='50px' position='relative' borderBottom='1px solid' borderColor='whiteAlpha.100' _last={{borderBottom: 'none'}}>
							<Box 
								position='absolute' 
								left='0' 
								transform={`translateX(${horsePositions[i] * 0.85}%)`} 
								transition='transform 0.1s linear'
							>
								<HStack spacing={0}>
									<Box as={motion.div} 
										animate={gameState === 'racing' ? {
											y: [0, -4, 0],
											rotate: [0, 2, -2, 0]
										} : {}}
										transition={{ repeat: Infinity, duration: 0.2 }}
									>
										<Text fontSize='40px' filter='drop-shadow(0 4px 8px rgba(0,0,0,0.4))' transform='scaleX(-1)'>{h.symbol}</Text>
									</Box>
									<VStack align='start' spacing={0} ml={-2}>
										<Badge size='xs' colorScheme='blackAlpha' bg={h.color} color='white' fontSize='8px' borderRadius='full' border='1px solid white'>{h.name}</Badge>
										{gameState === 'racing' && horsePositions[i] > 10 && (
											<Box as={motion.div} animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }} transition={{ repeat: Infinity, duration: 0.1 }} w='10px' h='4px' bg='orange.300' borderRadius='full' opacity={0.4} filter='blur(2px)' />
										)}
									</VStack>
								</HStack>
							</Box>
						</Box>
					))}
				</VStack>
				
				{gameState === 'finished' && (
					<Center position='absolute' inset={0} bg='blackAlpha.800' backdropFilter='blur(8px)' borderRadius='24px' zIndex={10}>
						<VStack spacing={6}>
							<Heading color='yellow.400' size='xl' letterSpacing='tighter'>PHOTO FINISH</Heading>
							<VStack spacing={3} w='100%' px={6}>
								{results.slice(0, 3).map((r, i) => (
									<HStack key={r.id} spacing={4} bg='whiteAlpha.100' p={4} borderRadius='20px' w='300px' border='1px solid' borderColor='whiteAlpha.200'>
										<Flex w='32px' h='32px' bg={i === 0 ? 'yellow.500' : i === 1 ? 'gray.400' : 'orange.600'} borderRadius='full' align='center' justify='center' fontWeight='900' color='white'>
											{i+1}
										</Flex>
										<Text color='white' flex={1} fontWeight='800'>{r.name}</Text>
										<Text color='yellow.400' fontWeight='900'>{r.odds}x</Text>
									</HStack>
								))}
							</VStack>
							<Button size='lg' colorScheme='yellow' px={10} borderRadius='20px' onClick={() => { setGameState('betting'); setHorsePositions(HORSE_DATA.map(() => 0)); setResults([]); }}>NEW RACE</Button>
						</VStack>
					</Center>
				)}

				{resultText && (
					<Box position='absolute' top={4} right={4} bg='blackAlpha.800' p={3} borderRadius='xl' border='2px solid' borderColor='yellow.400' boxShadow='xl' zIndex={5}>
						<Text color='white' fontWeight='900'>{resultText}</Text>
					</Box>
				)}
			</Box>

			{/* Betting Area */}
			<VStack w='100%' spacing={6} bg='surface' p={8} borderRadius='40px' border='1px solid' borderColor='border' boxShadow='inner'>
				<Box w='100%'>
					<HStack justify='space-between' mb={4}>
						<VStack align='start' spacing={0}>
							<Text fontSize='xs' fontWeight='900' color='textSecondary' letterSpacing='widest'>WAGER SUMMARY</Text>
							<Text fontSize='2xl' fontWeight='900' color='textPrimary'>{totalBet} BT</Text>
						</VStack>
						<HStack spacing={3}>
							{[10, 50, 100, 500, 1000].map(amt => (
								<Chip key={amt} amount={amt} active={activeChip === amt} onClick={() => { setActiveChip(amt); triggerHaptic(); }} />
							))}
							<IconButton icon={<IoTrashOutline />} onClick={() => setBets({})} aria-label='clear' colorScheme='red' variant='ghost' borderRadius='full' />
						</HStack>
					</HStack>
				</Box>

				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w='100%'>
					{HORSE_DATA.map(h => (
						<Box 
							key={h.id} bg='blackAlpha.300' p={5} borderRadius='28px' border='2px solid' 
							borderColor={Object.keys(bets).some(k => k.endsWith(`_${h.id}`)) ? h.color : 'whiteAlpha.100'} 
							transition='all 0.3s'
							_hover={{ transform: 'translateY(-2px)', bg: 'blackAlpha.400' }}
						>
							<HStack justify='space-between' mb={4}>
								<HStack spacing={3}>
									<Flex w='40px' h='40px' borderRadius='14px' bg={h.color} align='center' justify='center' boxShadow='lg'>
										<Text fontSize='xl' transform='scaleX(-1)'>{h.symbol}</Text>
									</Flex>
									<Box>
										<Text fontWeight='900' fontSize='md' letterSpacing='tight'>{h.name}</Text>
										<Text fontSize='10px' color='yellow.500' fontWeight='900'>{h.odds}x PAYOUT</Text>
									</Box>
								</HStack>
							</HStack>
							<HStack spacing={2}>
								<VStack flex={1} spacing={1}>
									<Button w='100%' size='sm' variant='solid' bg='green.600' _hover={{bg:'green.500'}} color='white' borderRadius='xl' onClick={() => placeBet('win', h.id)}>WIN</Button>
									{bets[`win_${h.id}`] && <Text fontSize='10px' fontWeight='900' color='green.400'>+{bets[`win_${h.id}`]} BT</Text>}
								</VStack>
								<VStack flex={1} spacing={1}>
									<Button w='100%' size='sm' variant='solid' bg='blue.600' _hover={{bg:'blue.500'}} color='white' borderRadius='xl' onClick={() => placeBet('place', h.id)}>PLACE</Button>
									{bets[`place_${h.id}`] && <Text fontSize='10px' fontWeight='900' color='blue.400'>+{bets[`place_${h.id}`]} BT</Text>}
								</VStack>
								<VStack flex={1} spacing={1}>
									<Button w='100%' size='sm' variant='solid' bg='orange.600' _hover={{bg:'orange.500'}} color='white' borderRadius='xl' onClick={() => placeBet('show', h.id)}>SHOW</Button>
									{bets[`show_${h.id}`] && <Text fontSize='10px' fontWeight='900' color='orange.400'>+{bets[`show_${h.id}`]} BT</Text>}
								</VStack>
							</HStack>
						</Box>
					))}
				</SimpleGrid>

				<Button 
					w='100%' h='70px' colorScheme={allReady ? 'green' : 'gray'} size='lg' fontSize='2xl' fontWeight='900' 
					isDisabled={gameState !== 'betting' || totalBet === 0 || !allReady} onClick={startRace}
					borderRadius='24px'
					boxShadow={allReady ? '0 10px 20px rgba(56, 161, 105, 0.3)' : 'none'}
					_active={{ transform: 'scale(0.98)' }}
				>
					{isMultiplayer && !allReady ? 'WAITING FOR PLAYERS...' : 'PLACE WAGERS'}
				</Button>
				{gameState === 'betting' && isMultiplayer && !allReady && (
					<Button w='100%' variant='ghost' colorScheme={isReady ? 'green' : 'yellow'} onClick={() => toggleReady(!isReady)}>
						{isReady ? 'READY!' : 'READY UP'}
					</Button>
				)}
			</VStack>
		</VStack>
	);
};

export default GamesPage;
