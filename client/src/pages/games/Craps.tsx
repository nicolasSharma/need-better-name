import { useState } from 'react';
import { Box, Flex, Text, VStack, HStack, Button, Heading, useToast, Badge, IconButton, Grid, GridItem } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoArrowBack, IoTrashOutline } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playWin, playThump, playPlink } from '@/lib/audio';
import { useLobby, Chip, LobbyDock, getChipForBet } from './shared';

const Craps = ({ onExit, balance }: { onExit: () => void; balance: number }) => {
	const { user } = useAuth();
	const { players } = useLobby('craps');
	const toast = useToast();

	const [activeChip, setActiveChip] = useState(50);
	const [bets, setBets] = useState<Record<string, number>>({});
	const [point, setPoint] = useState<number | null>(null);
	const [dice, setDice] = useState<[number, number]>([1, 1]);
	const [rolling, setRolling] = useState(false);
	const [resultText, setResultText] = useState('');
	const [showResult, setShowResult] = useState(false);
	const [winState, setWinState] = useState<'win' | 'lose' | 'neutral'>('neutral');

	const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

	const placeBet = (type: string) => {
		if (rolling) return;
		
		// If in point phase, pass and dontpass bets are locked and cannot be modified!
		if (point !== null && (type === 'pass' || type === 'dontpass')) {
			toast({ title: 'Pass Line bets are locked during Point Phase!', status: 'warning', duration: 2000 });
			return;
		}

		triggerHaptic();
		playPlink();
		setBets(prev => ({
			...prev,
			[type]: (prev[type] || 0) + activeChip
		}));
	};

	const clearBets = () => {
		if (rolling) return;
		if (point !== null) {
			// Clear all EXCEPT pass and dontpass which are locked
			setBets(prev => {
				const next: Record<string, number> = {};
				if (prev['pass']) next['pass'] = prev['pass'];
				if (prev['dontpass']) next['dontpass'] = prev['dontpass'];
				return next;
			});
		} else {
			setBets({});
		}
	};

	const rollDice = () => {
		if (rolling || totalBet === 0) return;
		if (balance < totalBet) {
			toast({ title: 'Insufficient balance', status: 'error' });
			return;
		}

		setRolling(true);
		setShowResult(false);
		setResultText('');
		triggerHaptic();

		// Fast random dice generation for visual rolling
		let rollsCount = 0;
		const rollInterval = setInterval(() => {
			playPlink();
			setDice([
				Math.floor(Math.random() * 6) + 1,
				Math.floor(Math.random() * 6) + 1
			]);
			rollsCount++;
			if (rollsCount > 10) {
				clearInterval(rollInterval);
				resolveRoll();
			}
		}, 100);
	};

	const resolveRoll = async () => {
		const die1 = Math.floor(Math.random() * 6) + 1;
		const die2 = Math.floor(Math.random() * 6) + 1;
		const sum = die1 + die2;
		setDice([die1, die2]);
		triggerHaptic();

		let roundPayout = 0;
		let roundLoss = 0;
		let msg = `Rolled a ${sum}! `;
		let nextPoint = point;
		let nextBets = { ...bets };
		let payoutStatus: 'win' | 'lose' | 'neutral' = 'neutral';

		// 1. Resolve Single Roll Bets (always resolved on every roll)
		if (bets['snake_eyes']) {
			if (sum === 2) {
				roundPayout += bets['snake_eyes'] * 31; // 30:1 + original bet
			} else {
				roundLoss += bets['snake_eyes'];
			}
			delete nextBets['snake_eyes'];
		}
		if (bets['boxcars']) {
			if (sum === 12) {
				roundPayout += bets['boxcars'] * 31; // 30:1 + original bet
			} else {
				roundLoss += bets['boxcars'];
			}
			delete nextBets['boxcars'];
		}
		if (bets['yo']) {
			if (sum === 11) {
				roundPayout += bets['yo'] * 16; // 15:1 + original bet
			} else {
				roundLoss += bets['yo'];
			}
			delete nextBets['yo'];
		}
		if (bets['any_craps']) {
			if (sum === 2 || sum === 3 || sum === 12) {
				roundPayout += bets['any_craps'] * 8; // 7:1 + original bet
			} else {
				roundLoss += bets['any_craps'];
			}
			delete nextBets['any_craps'];
		}

		// 2. Resolve Pass/Don't Pass Bets
		if (point === null) {
			// Come-out Roll Phase
			if (sum === 7 || sum === 11) {
				// Pass wins, Don't Pass loses
				if (bets['pass']) {
					roundPayout += bets['pass'] * 2;
					payoutStatus = 'win';
				}
				if (bets['dontpass']) {
					roundLoss += bets['dontpass'];
				}
				msg += 'Pass Line Wins!';
				delete nextBets['pass'];
				delete nextBets['dontpass'];
			} else if (sum === 2 || sum === 3 || sum === 12) {
				// Craps! Don't Pass wins (push on 12), Pass loses
				if (bets['pass']) {
					roundLoss += bets['pass'];
				}
				if (bets['dontpass']) {
					if (sum === 12) {
						roundPayout += bets['dontpass']; // Push (returns original bet)
						payoutStatus = 'neutral';
					} else {
						roundPayout += bets['dontpass'] * 2;
						payoutStatus = 'win';
					}
				}
				msg += `Craps ${sum}! Don't Pass Wins!`;
				delete nextBets['pass'];
				delete nextBets['dontpass'];
			} else {
				// Set the point
				nextPoint = sum;
				msg += `The Point is set to ${sum}!`;
			}
		} else {
			// Point Phase
			if (sum === point) {
				// Point Hit! Pass wins, Don't Pass loses
				if (bets['pass']) {
					roundPayout += bets['pass'] * 2;
					payoutStatus = 'win';
				}
				if (bets['dontpass']) {
					roundLoss += bets['dontpass'];
				}
				msg += 'Point Hit! Pass Line Wins!';
				nextPoint = null;
				delete nextBets['pass'];
				delete nextBets['dontpass'];
			} else if (sum === 7) {
				// Seven-out! Don't Pass wins, Pass loses
				if (bets['dontpass']) {
					roundPayout += bets['dontpass'] * 2;
					payoutStatus = 'win';
				}
				if (bets['pass']) {
					roundLoss += bets['pass'];
				}
				msg += 'Seven-Out! Don\'t Pass Wins!';
				nextPoint = null;
				delete nextBets['pass'];
				delete nextBets['dontpass'];
			} else {
				msg += 'Roll again to make the Point!';
			}
		}

		// Deduct bet and process payout in database
		const rollCost = Object.keys(bets).reduce((acc, key) => {
			// Only count the cost of bets resolved this roll
			if (key !== 'pass' && key !== 'dontpass') return acc + bets[key];
			if (nextPoint === null) return acc + bets[key]; // if resolved
			return acc; // if locked in Point phase (cost was already paid or is carried)
		}, 0);

		// If point was set in this roll, the cost of pass/dontpass is paid now
		const isComeOutSettingPoint = point === null && nextPoint !== null;
		const totalResolvedOrSetCost = rollCost + (isComeOutSettingPoint ? (bets['pass'] || 0) + (bets['dontpass'] || 0) : 0);

		if (roundPayout > totalResolvedOrSetCost) {
			payoutStatus = 'win';
			playWin();
		} else if (roundPayout < totalResolvedOrSetCost) {
			payoutStatus = 'lose';
			playThump();
		}

		setBets(nextBets);
		setPoint(nextPoint);
		setResultText(msg);
		setWinState(payoutStatus);
		setShowResult(true);
		setRolling(false);

		await playCasinoGame(user!.uid, totalResolvedOrSetCost, roundPayout, 'craps', `Craps: ${msg}`);
	};

	const dieFace = (val: number) => {
		const dots: Record<number, number[]> = {
			1: [4],
			2: [2, 6],
			3: [2, 4, 6],
			4: [1, 2, 6, 7],
			5: [1, 2, 4, 6, 7],
			6: [1, 2, 3, 5, 6, 7]
		};
		const activeDots = dots[val] || [];
		return (
			<Grid templateColumns='repeat(3, 1fr)' gap={1} p={2} w='64px' h='64px' bg='white' borderRadius='12px' border='2px solid' borderColor='gray.300' boxShadow='lg'>
				{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
					<Box key={i} display='flex' alignItems='center' justifyContent='center'>
						{activeDots.includes(i) && <Box w='10px' h='10px' borderRadius='full' bg='black' />}
					</Box>
				))}
			</Grid>
		);
	};

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)' px={4}>
			<VStack spacing={6} w='100%' flex={1}>
				<Flex w='100%' justify='space-between' align='center' py={2}>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}>
						<Heading size='sm' color='textPrimary'>Craps Table</Heading>
						<LobbyDock players={players} />
					</VStack>
					<Box w='40px' />
				</Flex>

				{/* Point Panel Indicator */}
				<HStack spacing={4} w='100%' justify='center'>
					<Badge colorScheme={point === null ? 'green' : 'orange'} fontSize='md' p={2} borderRadius='lg'>
						{point === null ? 'COME-OUT ROLL' : `POINT PHASE: ${point}`}
					</Badge>
				</HStack>

				{/* Felt Betting Table Layout */}
				<VStack w='100%' spacing={4} bg='green.800' p={4} borderRadius='24px' border='4px solid' borderColor='#D4AF37' boxShadow='2xl'>
					{/* Pass / Dont Pass Line */}
					<Grid templateColumns='repeat(2, 1fr)' gap={3} w='100%'>
						<GridItem>
							<Button
								w='100%'
								h='72px'
								bg='green.600'
								color='white'
								border='2px solid white'
								borderRadius='16px'
								position='relative'
								onClick={() => placeBet('pass')}
								_hover={{ bg: 'green.500' }}
							>
								<VStack spacing={0}>
									<Text fontWeight='900'>PASS LINE</Text>
									<Text fontSize='9px'>Pays 1:1</Text>
								</VStack>
								{bets['pass'] && (
									<Box position='absolute' top='-10px' right='-10px' transform='scale(0.55)'>
										<Chip amount={getChipForBet(bets['pass'])} active={false} onClick={() => {}} />
									</Box>
								)}
							</Button>
						</GridItem>
						<GridItem>
							<Button
								w='100%'
								h='72px'
								bg='blackAlpha.600'
								color='white'
								border='2px solid white'
								borderRadius='16px'
								position='relative'
								onClick={() => placeBet('dontpass')}
								_hover={{ bg: 'blackAlpha.500' }}
							>
								<VStack spacing={0}>
									<Text fontWeight='900'>DON'T PASS</Text>
									<Text fontSize='9px'>Pays 1:1</Text>
								</VStack>
								{bets['dontpass'] && (
									<Box position='absolute' top='-10px' right='-10px' transform='scale(0.55)'>
										<Chip amount={getChipForBet(bets['dontpass'])} active={false} onClick={() => {}} />
									</Box>
								)}
							</Button>
						</GridItem>
					</Grid>

					{/* Proposition / Single Roll Bets */}
					<Text color='whiteAlpha.700' fontSize='xs' fontWeight='bold' alignSelf='start' mt={2}>PROPOSITION SINGLE-ROLL BETS</Text>
					<Grid templateColumns='repeat(2, 1fr)' gap={3} w='100%'>
						<GridItem>
							<Button
								w='100%'
								h='60px'
								bg='green.700'
								color='white'
								border='1px dashed white'
								borderRadius='14px'
								position='relative'
								onClick={() => placeBet('snake_eyes')}
								_hover={{ bg: 'green.600' }}
							>
								<VStack spacing={0}>
									<Text fontWeight='bold' fontSize='xs'>SNAKE EYES (2)</Text>
									<Text fontSize='9px'>Pays 30:1</Text>
								</VStack>
								{bets['snake_eyes'] && (
									<Box position='absolute' top='-10px' right='-10px' transform='scale(0.45)'>
										<Chip amount={getChipForBet(bets['snake_eyes'])} active={false} onClick={() => {}} />
									</Box>
								)}
							</Button>
						</GridItem>
						<GridItem>
							<Button
								w='100%'
								h='60px'
								bg='green.700'
								color='white'
								border='1px dashed white'
								borderRadius='14px'
								position='relative'
								onClick={() => placeBet('boxcars')}
								_hover={{ bg: 'green.600' }}
							>
								<VStack spacing={0}>
									<Text fontWeight='bold' fontSize='xs'>BOXCARS (12)</Text>
									<Text fontSize='9px'>Pays 30:1</Text>
								</VStack>
								{bets['boxcars'] && (
									<Box position='absolute' top='-10px' right='-10px' transform='scale(0.45)'>
										<Chip amount={getChipForBet(bets['boxcars'])} active={false} onClick={() => {}} />
									</Box>
								)}
							</Button>
						</GridItem>
						<GridItem>
							<Button
								w='100%'
								h='60px'
								bg='green.700'
								color='white'
								border='1px dashed white'
								borderRadius='14px'
								position='relative'
								onClick={() => placeBet('yo')}
								_hover={{ bg: 'green.600' }}
							>
								<VStack spacing={0}>
									<Text fontWeight='bold' fontSize='xs'>YO-LEVEN (11)</Text>
									<Text fontSize='9px'>Pays 15:1</Text>
								</VStack>
								{bets['yo'] && (
									<Box position='absolute' top='-10px' right='-10px' transform='scale(0.45)'>
										<Chip amount={getChipForBet(bets['yo'])} active={false} onClick={() => {}} />
									</Box>
								)}
							</Button>
						</GridItem>
						<GridItem>
							<Button
								w='100%'
								h='60px'
								bg='green.700'
								color='white'
								border='1px dashed white'
								borderRadius='14px'
								position='relative'
								onClick={() => placeBet('any_craps')}
								_hover={{ bg: 'green.600' }}
							>
								<VStack spacing={0}>
									<Text fontWeight='bold' fontSize='xs'>ANY CRAPS (2/3/12)</Text>
									<Text fontSize='9px'>Pays 7:1</Text>
								</VStack>
								{bets['any_craps'] && (
									<Box position='absolute' top='-10px' right='-10px' transform='scale(0.45)'>
										<Chip amount={getChipForBet(bets['any_craps'])} active={false} onClick={() => {}} />
									</Box>
								)}
							</Button>
						</GridItem>
					</Grid>
				</VStack>

				{/* Interactive 3D Dice Display Box */}
				<HStack spacing={8} justify='center' my={6} position='relative'>
					<AnimatePresence>
						{showResult && (
							<Box
								as={motion.div}
								initial={{ scale: 0, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0, opacity: 0 }}
								position='absolute'
								top='-40px'
								zIndex={15}
							>
								<Badge
									colorScheme={winState === 'win' ? 'green' : winState === 'lose' ? 'red' : 'gray'}
									fontSize='xl'
									px={4}
									py={2}
									borderRadius='xl'
									boxShadow='lg'
									border='2px solid white'
								>
									{resultText}
								</Badge>
							</Box>
						)}
					</AnimatePresence>

					<Box
						as={motion.div}
						animate={rolling ? {
							rotate: [0, 360, 720, 1080],
							x: [0, -40, 20, -10, 0],
							y: [0, -30, 40, -10, 0]
						} : {}}
						transition={{ duration: 1, ease: 'easeInOut' }}
					>
						{dieFace(dice[0])}
					</Box>
					<Box
						as={motion.div}
						animate={rolling ? {
							rotate: [0, -360, -720, -1080],
							x: [0, 40, -20, 10, 0],
							y: [0, -40, 30, -5, 0]
						} : {}}
						transition={{ duration: 1, ease: 'easeInOut' }}
					>
						{dieFace(dice[1])}
					</Box>
				</HStack>
			</VStack>

			{/* Controls and Bet Slip */}
			<Box w='100%' pt={10}>
				<VStack w='100%'>
					{!rolling && (
						<HStack w='100%' justify='center' spacing={4} mb={6}>
							{[10, 50, 100, 500].map(amt => (
								<Chip key={amt} amount={amt} active={activeChip === amt} onClick={() => { setActiveChip(amt); triggerHaptic(); }} />
							))}
							<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='textSecondary' onClick={clearBets} aria-label='clear' />
						</HStack>
					)}

					<VStack w='100%' spacing={2}>
						<Badge variant='outline' colorScheme='yellow' fontSize='lg' py={1} px={4} borderRadius='full'>
							TOTAL BET: {totalBet} BT
						</Badge>
						<Button
							w='100%'
							h='60px'
							colorScheme='green'
							size='lg'
							fontSize='xl'
							fontWeight='900'
							isDisabled={rolling || totalBet === 0 || totalBet > balance}
							onClick={rollDice}
							borderRadius='24px'
							boxShadow='0 10px 20px rgba(56, 161, 105, 0.3)'
							_active={{ transform: 'scale(0.98)' }}
						>
							ROLL DICE
						</Button>
					</VStack>
				</VStack>
			</Box>
		</Flex>
	);
};

export default Craps;
