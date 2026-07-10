import { useState, useEffect, useRef } from 'react';
import { Box, Flex, Text, VStack, HStack, Button, Heading, useToast, Badge, Icon, IconButton, NumberInput, NumberInputField, Progress } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoArrowBack, IoPlayOutline, IoRibbonOutline } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { useUser } from '@/context/AppDataProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playWin, playThump, playPlink } from '@/lib/audio';
import Confetti from '@/components/Confetti';
import { useLobby } from './shared';

interface Horse {
	id: number;
	name: string;
	color: string;
	odds: number;
}

const HORSES: Horse[] = [
	{ id: 1, name: 'Thunder Bolt', color: '#E53E3E', odds: 2 },
	{ id: 2, name: 'Lucky Strike', color: '#3182CE', odds: 3 },
	{ id: 3, name: 'Midnight Run', color: '#805AD5', odds: 5 },
	{ id: 4, name: 'Golden Arrow', color: '#D69E2E', odds: 8 },
	{ id: 5, name: 'Dark Horse', color: '#4A5568', odds: 12 },
	{ id: 6, name: 'Wild Card', color: '#DD6B20', odds: 20 },
];

const HorseRacing = ({ onExit, balance }: { onExit: () => void; balance: number }) => {
	const { user } = useAuth();
	const { players } = useLobby('race');
	const toast = useToast();
	const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
	const [bet, setBet] = useState(50);
	const [gameState, setGameState] = useState<'betting' | 'racing' | 'finished'>('betting');
	const [positions, setPositions] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
	const [standings, setStandings] = useState<number[]>([1, 2, 3, 4, 5, 6]);
	const [winnerId, setWinnerId] = useState<number | null>(null);
	const [resultText, setResultText] = useState('');
	const [confetti, setConfetti] = useState(false);
	const animationRef = useRef<number | null>(null);
	const posRef = useRef<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });

	const startRace = async () => {
		if (!selectedHorseId) { toast({ title: 'Select a horse', status: 'warning' }); return; }
		if (bet <= 0 || balance < bet) { toast({ title: 'Insufficient BT or invalid bet', status: 'error' }); return; }

		setGameState('racing');
		setWinnerId(null);
		setResultText('');
		setConfetti(false);
		triggerHaptic();
		playPlink();

		// Determine winner at the start
		const winner = HORSES[Math.floor(Math.random() * HORSES.length)].id;

		// Pre-calculate positions for 4 stages (every 2 seconds)
		const stage1: Record<number, number> = {};
		const stage2: Record<number, number> = {};
		const stage3: Record<number, number> = {};
		const stage4: Record<number, number> = {};

		HORSES.forEach(h => {
			stage1[h.id] = 15 + Math.random() * 20; // 15% - 35%
			stage2[h.id] = 40 + Math.random() * 20; // 40% - 60%
			stage3[h.id] = 65 + Math.random() * 20; // 65% - 85%
			stage4[h.id] = h.id === winner ? 100 : 85 + Math.random() * 10; // Winner is 100%, others 85% - 95%
		});

		const updateStandings = (posMap: Record<number, number>) => {
			const sorted = [...HORSES]
				.sort((a, b) => posMap[b.id] - posMap[a.id])
				.map(h => h.id);
			setStandings(sorted);
		};

		// Reset to 0% first
		setPositions({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
		setStandings([1, 2, 3, 4, 5, 6]);

		// Timeout array to clear if component unmounts
		const timeouts: NodeJS.Timeout[] = [];

		// Stage 1 (0s -> 2s)
		timeouts.push(setTimeout(() => {
			setPositions(stage1);
			updateStandings(stage1);
		}, 50));

		// Stage 2 (2s -> 4s)
		timeouts.push(setTimeout(() => {
			setPositions(stage2);
			updateStandings(stage2);
		}, 2000));

		// Stage 3 (4s -> 6s)
		timeouts.push(setTimeout(() => {
			setPositions(stage3);
			updateStandings(stage3);
		}, 4000));

		// Stage 4 (6s -> 8s)
		timeouts.push(setTimeout(() => {
			setPositions(stage4);
			updateStandings(stage4);
		}, 6000));

		// Resolve Race (8.2s)
		timeouts.push(setTimeout(() => {
			setWinnerId(winner);
			resolveRace(winner);
		}, 8200));

		// Save timeouts in a ref to clean up on unmount
		(window as any)._raceTimeouts = timeouts;
	};

	const resolveRace = async (winner: number) => {
		setGameState('finished');
		const userHorse = HORSES.find(h => h.id === selectedHorseId)!;
		const winningHorse = HORSES.find(h => h.id === winner)!;
		
		let payout = 0;
		let message = '';

		if (selectedHorseId === winner) {
			// Odds of X:1 means payout is bet * (odds + 1) -> profit of (bet * odds) + original bet
			payout = bet * (userHorse.odds + 1);
			message = `WIN! ${userHorse.name} won at ${userHorse.odds}:1. Payout: ${payout} BT!`;
			playWin();
			setConfetti(true);
		} else {
			payout = 0;
			message = `LOST. ${winningHorse.name} won the race.`;
			playThump();
		}

		setResultText(message);
		await playCasinoGame(user!.uid, bet, payout, 'race', `Horse Racing: ${message}`);
	};

	useEffect(() => {
		return () => {
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
		};
	}, []);

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)' px={4}>
			<Confetti fire={confetti} />
			<VStack spacing={6} w='100%' flex={1}>
				<Flex w='100%' justify='space-between' align='center' py={2}>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}>
						<Heading size='sm' color='textPrimary'>Derby Simulator</Heading>
						{players.length > 0 && <Badge colorScheme='blue'>Active Players: {players.length}</Badge>}
					</VStack>
					<Box w='40px' />
				</Flex>

				{gameState === 'betting' && (
					<VStack spacing={6} w='100%'>
						<Text fontSize='sm' fontWeight='bold' color='textSecondary' alignSelf='start'>SELECT YOUR CHAMPION</Text>
						<VStack spacing={3} w='100%'>
							{HORSES.map(horse => (
								<Flex
									key={horse.id}
									w='100%'
									p={4}
									borderRadius='16px'
									border='2px solid'
									borderColor={selectedHorseId === horse.id ? 'primaryAction' : 'border'}
									bg='surface'
									align='center'
									justify='space-between'
									cursor='pointer'
									onClick={() => { setSelectedHorseId(horse.id); triggerHaptic(); }}
									_hover={{ borderColor: 'primaryAction' }}
									transition='0.2s'
								>
									<HStack spacing={4}>
										<Box w='16px' h='16px' borderRadius='full' bg={horse.color} />
										<Text fontWeight='900' color='textPrimary'>{horse.name}</Text>
									</HStack>
									<Badge colorScheme='purple' fontSize='md' px={3} py={1} borderRadius='lg'>{horse.odds}:1 Odds</Badge>
								</Flex>
							))}
						</VStack>

						<VStack w='100%' spacing={4} pt={4}>
							<HStack w='100%' justify='space-between' align='center'>
								<Text fontSize='md' fontWeight='900' color='textPrimary'>YOUR BET</Text>
								<NumberInput value={bet} onChange={v => setBet(parseInt(v) || 0)} min={10} max={balance}>
									<NumberInputField maxW='120px' h='48px' borderRadius='16px' border='2px solid' borderColor='border' fontWeight='bold' textAlign='center' />
								</NumberInput>
							</HStack>
							<Button
								w='100%'
								h='64px'
								colorScheme='blue'
								borderRadius='24px'
								fontSize='xl'
								fontWeight='900'
								isDisabled={!selectedHorseId || bet <= 0 || bet > balance}
								onClick={startRace}
							>
								START RACE
							</Button>
						</VStack>
					</VStack>
				)}

				{(gameState === 'racing' || gameState === 'finished') && (
					<VStack spacing={6} w='100%' py={4}>
						{/* Racetrack UI */}
						<VStack w='100%' spacing={2} bg='rgba(0,0,0,0.3)' p={4} borderRadius='24px' border='1px solid' borderColor='border' position='relative'>
							{HORSES.map(horse => (
								<Flex key={horse.id} w='100%' align='center' py={2} borderBottom='1px dashed' borderColor='whiteAlpha.200'>
									<Text w='24px' fontSize='xs' fontWeight='900' color='textSecondary'>#{horse.id}</Text>
									<Box flex={1} position='relative' h='24px' bg='blackAlpha.300' borderRadius='full' overflow='visible'>
										{/* Finish Line */}
										<Box position='absolute' right='10%' top={0} bottom={0} w='2px' bg='red.500' zIndex={1} opacity={0.6} />
										<Box
											id={`horse-dot-${horse.id}`}
											position='absolute'
											left={`${positions[horse.id]}%`}
											transform='translateX(-50%)'
											zIndex={2}
										>
											<VStack spacing={0}>
												<Box w='20px' h='20px' borderRadius='full' bg={horse.color} border='2px solid white' boxShadow='lg' display='flex' alignItems='center' justifyContent='center'>
													<Text color='white' fontSize='9px' fontWeight='900'>{horse.id}</Text>
												</Box>
											</VStack>
										</Box>
									</Box>
								</Flex>
							))}
						</VStack>

						{/* Realtime Standings */}
						<VStack w='100%' align='start' spacing={2} p={4} bg='surface' borderRadius='20px' border='1px solid' borderColor='border'>
							<Heading size='xs' color='textSecondary' letterSpacing='widest' mb={2}>LIVE STANDINGS</Heading>
							{standings.map((id, index) => {
								const horse = HORSES.find(h => h.id === id)!;
								return (
									<HStack key={id} justify='space-between' w='100%'>
										<HStack spacing={3}>
											<Text fontWeight='900' w='20px' color={index === 0 ? 'yellow.500' : 'textSecondary'}>{index + 1}.</Text>
											<Box w='12px' h='12px' borderRadius='full' bg={horse.color} />
											<Text fontSize='sm' fontWeight='bold' color='textPrimary'>{horse.name}</Text>
										</HStack>
										<Badge colorScheme={selectedHorseId === id ? 'blue' : 'gray'}>
											{selectedHorseId === id ? 'Your Pick' : `${positions[id].toFixed(0)}%`}
										</Badge>
									</HStack>
								);
							})}
						</VStack>

						{gameState === 'finished' && (
							<VStack spacing={4} w='100%' pt={4}>
								<Badge colorScheme={winnerId === selectedHorseId ? 'green' : 'red'} fontSize='xl' px={4} py={2} borderRadius='xl'>
									{resultText}
								</Badge>
								<Button
									w='100%'
									h='56px'
									colorScheme='blue'
									borderRadius='20px'
									onClick={() => { setGameState('betting'); setSelectedHorseId(null); }}
								>
									BACK TO DERBY
								</Button>
							</VStack>
						)}
					</VStack>
				)}
			</VStack>
		</Flex>
	);
};

export default HorseRacing;
