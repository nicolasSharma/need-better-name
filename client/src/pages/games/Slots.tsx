import { useState, useEffect, useRef } from 'react';
import { Box, Flex, Text, VStack, HStack, Button, Heading, useToast, Badge, IconButton } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoArrowBack, IoTrashOutline } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playWin, playThump, playPlink } from '@/lib/audio';
import { useLobby, Chip, LobbyDock } from './shared';

const EMOJIS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];

const Slots = ({ onExit, balance }: { onExit: () => void; balance: number }) => {
	const { user } = useAuth();
	const { players } = useLobby('slots');
	const toast = useToast();
	
	const [bet, setBet] = useState(50);
	const [spinning, setSpinning] = useState(false);
	const [reels, setReels] = useState<string[]>(['7️⃣', '7️⃣', '7️⃣']);
	const [resultText, setResultText] = useState('');
	const [payoutAmount, setPayoutAmount] = useState(0);
	const [showResult, setShowResult] = useState(false);

	const spinIntervals = useRef<(NodeJS.Timeout | null)[]>([null, null, null]);

	const calculateResult = (finalReels: string[]) => {
		const [r1, r2, r3] = finalReels;
		let multiplier = 0;

		// 3 of a kind
		if (r1 === r2 && r2 === r3) {
			if (r1 === '7️⃣') multiplier = 50;
			else if (r1 === '💎') multiplier = 30;
			else if (r1 === '🔔') multiplier = 20;
			else multiplier = 10;
		}
		// 2 of a kind
		else if (r1 === r2 || r2 === r3 || r1 === r3) {
			multiplier = 2;
		}

		return multiplier;
	};

	const startSpin = () => {
		if (spinning || bet <= 0) return;
		if (balance < bet) {
			toast({ title: 'Insufficient balance', status: 'error' });
			return;
		}

		setSpinning(true);
		setShowResult(false);
		setResultText('');
		setPayoutAmount(0);
		triggerHaptic();

		// Pre-determine final results
		const finalReels = [
			EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
			EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
			EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
		];

		// Start fast interval rolling for each reel
		const startReelInterval = (index: number) => {
			spinIntervals.current[index] = setInterval(() => {
				playPlink();
				setReels(prev => {
					const next = [...prev];
					next[index] = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
					return next;
				});
			}, 70 + index * 20); // Slightly offset speeds
		};

		startReelInterval(0);
		startReelInterval(1);
		startReelInterval(2);

		// Stop Reel 1 (800ms)
		setTimeout(() => {
			if (spinIntervals.current[0]) {
				clearInterval(spinIntervals.current[0]);
				spinIntervals.current[0] = null;
			}
			setReels(prev => {
				const next = [...prev];
				next[0] = finalReels[0];
				return next;
			});
			triggerHaptic();
		}, 800);

		// Stop Reel 2 (1400ms)
		setTimeout(() => {
			if (spinIntervals.current[1]) {
				clearInterval(spinIntervals.current[1]);
				spinIntervals.current[1] = null;
			}
			setReels(prev => {
				const next = [...prev];
				next[1] = finalReels[1];
				return next;
			});
			triggerHaptic();
		}, 1400);

		// Stop Reel 3 (2000ms)
		setTimeout(async () => {
			if (spinIntervals.current[2]) {
				clearInterval(spinIntervals.current[2]);
				spinIntervals.current[2] = null;
			}
			setReels(prev => {
				const next = [...prev];
				next[2] = finalReels[2];
				return next;
			});
			triggerHaptic();

			// Resolve
			const mult = calculateResult(finalReels);
			const payout = bet * mult;
			setPayoutAmount(payout);

			let message = '';
			if (payout > 0) {
				message = `WON ${payout} BT!`;
				setResultText(message);
				playWin();
			} else {
				message = 'LOST';
				setResultText(message);
				playThump();
			}

			await playCasinoGame(user!.uid, bet, payout, 'slots', `Slots Spin: ${finalReels.join(' | ')} (${message})`);
			setSpinning(false);
			setShowResult(true);
		}, 2000);
	};

	useEffect(() => {
		return () => {
			spinIntervals.current.forEach(interval => {
				if (interval) clearInterval(interval);
			});
		};
	}, []);

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)' px={4}>
			<VStack spacing={6} w='100%' flex={1}>
				<Flex w='100%' justify='space-between' align='center' py={2}>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}>
						<Heading size='sm' color='textPrimary'>Super Slots</Heading>
						<LobbyDock players={players} />
					</VStack>
					<Box w='40px' />
				</Flex>

				{/* Payout table banner */}
				<HStack spacing={2} bg='surface' p={3} borderRadius='xl' border='1px solid' borderColor='border' wrap='wrap' justify='center' maxW='100%'>
					<Badge colorScheme='red'>7️⃣7️⃣7️⃣ = 50x</Badge>
					<Badge colorScheme='purple'>💎💎💎 = 30x</Badge>
					<Badge colorScheme='yellow'>🔔🔔🔔 = 20x</Badge>
					<Badge colorScheme='blue'>Match 3 = 10x</Badge>
					<Badge colorScheme='green'>Match 2 = 2x</Badge>
				</HStack>

				{/* Slots Machine Cabinet */}
				<Box
					w='300px'
					bgGradient='linear(to-b, gray.700, gray.900)'
					borderRadius='32px'
					border='8px solid'
					borderColor='#D4AF37'
					p={6}
					boxShadow='2xl'
					position='relative'
				>
					{/* Machine Title Panel */}
					<Center mb={6} bg='blackAlpha.600' py={2} borderRadius='md' border='2px solid' borderColor='red.500'>
						<Text fontWeight='900' letterSpacing='widest' color='red.500' textShadow='0 0 10px rgba(255,0,0,0.8)'>BAR & SEVENS</Text>
					</Center>

					{/* Reels Slot Viewport */}
					<HStack spacing={3} justify='center' bg='black' p={4} borderRadius='20px' border='4px solid' borderColor='gray.800'>
						{reels.map((emoji, idx) => (
							<Flex
								key={idx}
								w='64px'
								h='80px'
								bg='white'
								borderRadius='12px'
								align='center'
								justify='center'
								boxShadow='inset 0 0 15px rgba(0,0,0,0.8)'
								as={motion.div}
								animate={spinning && !spinIntervals.current[idx] ? { scale: [1, 1.1, 1] } : {}}
								transition={{ duration: 0.2 }}
							>
								<Text fontSize='4xl'>{emoji}</Text>
							</Flex>
						))}
					</HStack>

					{/* Result Text Overlay */}
					<AnimatePresence>
						{showResult && (
							<Box
								as={motion.div}
								initial={{ scale: 0, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0, opacity: 0 }}
								position='absolute'
								top='40%'
								left='50%'
								transform='translate(-50%, -50%)'
								zIndex={10}
								pointerEvents='none'
							>
								<Badge
									colorScheme={payoutAmount > 0 ? 'green' : 'red'}
									fontSize='2xl'
									px={4}
									py={2}
									borderRadius='xl'
									boxShadow='dark-lg'
									border='3px solid white'
								>
									{resultText}
								</Badge>
							</Box>
						)}
					</AnimatePresence>

					{/* Bottom panel decoration */}
					<Box mt={6} borderTop='4px solid' borderColor='gray.700' pt={4}>
						<HStack justify='space-between'>
							<Box w='8px' h='8px' borderRadius='full' bg='green.400' filter='drop-shadow(0 0 4px green)' />
							<Box w='8px' h='8px' borderRadius='full' bg='red.400' filter='drop-shadow(0 0 4px red)' />
						</HStack>
					</Box>
				</Box>
			</VStack>

			{/* Controls */}
			<Box w='100%' pt={10}>
				<VStack w='100%'>
					{!spinning && (
						<HStack w='100%' justify='center' spacing={4} mb={6}>
							{[10, 50, 100, 500].map(amt => (
								<Chip key={amt} amount={amt} active={false} onClick={() => { setBet(prev => prev + amt); triggerHaptic(); }} />
							))}
							<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='textSecondary' onClick={() => setBet(0)} aria-label='clear' />
						</HStack>
					)}

					<VStack w='100%' spacing={2}>
						<Badge variant='outline' colorScheme='yellow' fontSize='lg' py={1} px={4} borderRadius='full'>
							BET: {bet} BT
						</Badge>
						<Button
							w='100%'
							h='60px'
							colorScheme='red'
							size='lg'
							fontSize='xl'
							fontWeight='900'
							isDisabled={spinning || bet <= 0 || bet > balance}
							onClick={startSpin}
							borderRadius='24px'
							boxShadow='0 10px 20px rgba(229, 62, 62, 0.3)'
							_active={{ transform: 'scale(0.98)' }}
						>
							SPIN
						</Button>
					</VStack>
				</VStack>
			</Box>
		</Flex>
	);
};

export default Slots;
