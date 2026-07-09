import { useState } from 'react';
import { Box, Flex, Text, VStack, HStack, Button, Heading, useToast, Badge, Icon, IconButton, SimpleGrid } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoArrowBack, IoTrashOutline, IoDiamondOutline, IoSkullOutline } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playCardFlip, playWin, playThump, playPlink } from '@/lib/audio';
import Confetti from '@/components/Confetti';
import { useLobby, Chip, LobbyDock } from './shared';

const Mines = ({ onExit, balance }: { onExit: () => void; balance: number }) => {
	const { user } = useAuth();
	const { players } = useLobby('mines');
	const toast = useToast();
	const [bet, setBet] = useState(0);
	const [mineCount, setMineCount] = useState(3);
	const [gameState, setGameState] = useState<'betting' | 'playing' | 'result'>('betting');
	const [grid, setGrid] = useState<{ id: number; type: 'gem' | 'mine'; revealed: boolean }[]>([]);
	const [revealedCount, setRevealedCount] = useState(0);
	const [confetti, setConfetti] = useState(false);

	const calcMult = (mines: number, revealed: number) => {
		if (revealed === 0) return 1;
		let prob = 1;
		for (let i = 0; i < revealed; i++) prob *= (25 - mines - i) / (25 - i);
		return Math.floor((1 / prob) * 100) / 100;
	};
	const currentMultiplier = calcMult(mineCount, revealedCount);

	const startNewGame = () => {
		if (balance < bet || bet <= 0) { toast({ title: 'Insufficient BT', status: 'error' }); return; }
		const newGrid: { id: number; type: 'gem' | 'mine'; revealed: boolean }[] = Array(25).fill(null).map((_, i) => ({ id: i, type: 'gem' as 'gem' | 'mine', revealed: false }));
		let placed = 0;
		while (placed < mineCount) { const idx = Math.floor(Math.random() * 25); if (newGrid[idx].type !== 'mine') { newGrid[idx].type = 'mine'; placed++; } }
		setGrid(newGrid); setRevealedCount(0); setGameState('playing'); setConfetti(false); triggerHaptic(); playPlink();
	};

	const handleTileClick = async (idx: number) => {
		if (gameState !== 'playing' || grid[idx].revealed) return;
		const ng = [...grid]; ng[idx].revealed = true; setGrid(ng);
		if (ng[idx].type === 'mine') { triggerHaptic(); playThump(); setGameState('result'); await playCasinoGame(user!.uid, bet, 0, 'mines', `Mines: Hit mine after ${revealedCount} gems`); }
		else { const nc = revealedCount + 1; setRevealedCount(nc); triggerHaptic(); playCardFlip(); if (nc === 25 - mineCount) handleCashOut(nc); }
	};

	const handleCashOut = async (countOverride?: number) => {
		if (gameState !== 'playing') return;
		const count = countOverride !== undefined ? countOverride : revealedCount;
		if (count === 0) return;
		const mult = calcMult(mineCount, count);
		const payout = Math.floor(bet * mult);
		setGameState('result'); setConfetti(true); playWin();
		await playCasinoGame(user!.uid, bet, payout, 'mines', `Mines: Cashed out ${mult}x (${payout} BT)`);
		setGrid(prev => prev.map(t => ({ ...t, revealed: true })));
	};

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)'>
			<VStack spacing={6} w='100%' flex={1}>
				<Confetti fire={confetti} />
				<Flex w='100%' justify='space-between' align='center'>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}><Heading size='sm' color='textPrimary'>House Mines</Heading><LobbyDock players={players} /></VStack>
					<Box w='40px' />
				</Flex>
				<VStack spacing={4}>
					<HStack spacing={4}>
						<VStack align='start' spacing={1}><Text fontSize='10px' fontWeight='900' color='textSecondary'>MULTIPLIER</Text><Badge fontSize='2xl' colorScheme='green' borderRadius='xl' px={4} py={1}>{currentMultiplier.toFixed(2)}x</Badge></VStack>
						<VStack align='start' spacing={1}><Text fontSize='10px' fontWeight='900' color='textSecondary'>NEXT PAYOUT</Text><Text fontSize='2xl' fontWeight='900' color='yesAction'>{Math.floor(bet * currentMultiplier)} BT</Text></VStack>
					</HStack>
					<SimpleGrid columns={5} spacing={2} p={4} bg='surfaceDeep' borderRadius='24px' border='1px solid' borderColor='border' boxShadow='inner'>
						{Array(25).fill(0).map((_, i) => {
							const tile = grid[i]; const isRevealed = tile?.revealed;
							return (<Box key={i} w='60px' h='60px' bg={isRevealed ? (tile.type === 'mine' ? 'red.500' : 'yesAction') : 'surface'} borderRadius='12px' cursor={gameState === 'playing' && !isRevealed ? 'pointer' : 'default'} onClick={() => handleTileClick(i)} as={motion.div} whileHover={gameState === 'playing' && !isRevealed ? { scale: 1.05 } : {}} whileTap={gameState === 'playing' && !isRevealed ? { scale: 0.95 } : {}} display='flex' alignItems='center' justifyContent='center' transition='all 0.2s' border='1px solid' borderColor='border' position='relative' overflow='hidden'>
								<AnimatePresence mode='wait'>
									{isRevealed ? (<motion.div key='icon' initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}><Icon as={tile.type === 'mine' ? IoSkullOutline : IoDiamondOutline} color='white' boxSize={6} /></motion.div>) : (<Box key='hidden' w='100%' h='100%' bgGradient='linear(to-br, surface, border)' opacity={0.5} />)}
								</AnimatePresence>
							</Box>);
						})}
					</SimpleGrid>
				</VStack>
			</VStack>
			<Box w='100%' pt={10}>
				{gameState === 'playing' ? (
					<Button w='100%' h='64px' colorScheme='green' borderRadius='24px' fontSize='xl' fontWeight='900' onClick={() => handleCashOut()} isDisabled={revealedCount === 0} boxShadow='0 10px 20px rgba(48, 209, 88, 0.3)'>CASH OUT {Math.floor(bet * currentMultiplier)} BT</Button>
				) : (
					<VStack w='100%' spacing={4}>
						<HStack w='100%' spacing={4}>
							<VStack flex={1} align='start' spacing={1}><Text fontSize='10px' fontWeight='900' color='textSecondary' ml={2}>MINES</Text><SimpleGrid columns={4} spacing={2} w='100%'>{[1, 3, 5, 24].map(m => (<Button key={m} size='sm' variant={mineCount === m ? 'solid' : 'surface'} colorScheme={mineCount === m ? 'red' : 'gray'} onClick={() => { setMineCount(m); triggerHaptic(); }}>{m}</Button>))}</SimpleGrid></VStack>
							<VStack flex={1} align='start' spacing={1}><Text fontSize='10px' fontWeight='900' color='textSecondary' ml={2}>BET</Text><HStack spacing={2} w='100%'>{[10, 100, 500].map(amt => (<Chip key={amt} amount={amt} active={false} onClick={() => { setBet(prev => prev + amt); triggerHaptic(); }} />))}<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' onClick={() => setBet(0)} aria-label='clear' /></HStack></VStack>
						</HStack>
						<Button w='100%' h='64px' colorScheme='blue' borderRadius='24px' fontSize='xl' fontWeight='900' onClick={startNewGame} isDisabled={bet === 0 || bet > balance}>PLAY {bet} BT</Button>
					</VStack>
				)}
			</Box>
		</Flex>
	);
};

export default Mines;
