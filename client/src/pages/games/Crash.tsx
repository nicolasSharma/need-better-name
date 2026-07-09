import { useState, useEffect, useRef } from 'react';
import { Box, Flex, Text, VStack, HStack, Button, Heading, useToast, Badge, Icon, IconButton } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { IoArrowBack, IoTrashOutline, IoRocketOutline, IoFlame } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playWin, playThump, playPlink } from '@/lib/audio';
import { useLobby, Chip, LobbyDock } from './shared';

const Crash = ({ onExit, balance }: { onExit: () => void; balance: number }) => {
	const { user } = useAuth();
	const { players } = useLobby('crash');
	const toast = useToast();

	const [multiplier, setMultiplier] = useState(1.00);
	const [gameState, setGameState] = useState<'betting' | 'climbing' | 'crashed'>('betting');
	const [bet, setBet] = useState(0);
	const [isCashedOut, setIsCashedOut] = useState(false);
	const [cashedOutAt, setCashedOutAt] = useState(0);
	const [crashPoint, setCrashPoint] = useState(0);
	const [history, setHistory] = useState<{ x: number; y: number }[]>([]);
	const timerRef = useRef<any>(null);
	const cashedOutRef = useRef(false);

	const startRound = () => {
		if (bet <= 0 || balance < bet) { toast({ title: 'Invalid Bet', status: 'error' }); return; }
		let cp = 1.01;
		const r = Math.random();
		if (r > 0.03) cp = Math.max(1.01, 0.98 / (1 - r)); else cp = 1.00;
		setCrashPoint(cp); setMultiplier(1.00); setHistory([{ x: 0, y: 1.00 }]); setGameState('climbing'); setIsCashedOut(false); setCashedOutAt(0); triggerHaptic(); playPlink();
		cashedOutRef.current = false;
		const startTime = Date.now();
		timerRef.current = setInterval(async () => {
			const elapsed = (Date.now() - startTime) / 1000;
			const nextMult = Math.pow(Math.E, 0.08 * elapsed);
			if (nextMult >= cp) {
				setMultiplier(cp); setHistory(prev => [...prev, { x: elapsed, y: cp }]); setGameState('crashed'); clearInterval(timerRef.current); playThump();
				if (!cashedOutRef.current) {
					await playCasinoGame(user!.uid, bet, 0, 'crash', `Crash: Crashed at ${cp.toFixed(2)}x`);
				}
			} else { setMultiplier(nextMult); setHistory(prev => [...prev, { x: elapsed, y: nextMult }]); }
		}, 60);
	};

	const handleCashOut = async () => {
		if (gameState !== 'climbing' || isCashedOut) return;
		const curMult = multiplier; setIsCashedOut(true); setCashedOutAt(curMult); triggerHaptic(); playWin();
		cashedOutRef.current = true;
		const payout = Math.floor(bet * curMult);
		await playCasinoGame(user!.uid, bet, payout, 'crash', `Crash: Cashed out at ${curMult.toFixed(2)}x`);
	};

	useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

	const chartWidth = 300; const chartHeight = 200;
	const maxTime = Math.max(10, history[history.length - 1]?.x || 0);
	const maxMult = Math.max(2, multiplier);
	const getX = (t: number) => (t / maxTime) * chartWidth;
	const getY = (m: number) => chartHeight - ((m - 1) / (maxMult - 1)) * chartHeight;
	const pathData = history.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.x)} ${getY(p.y)}`).join(' ');

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)'>
			<VStack spacing={6} w='100%' flex={1}>
				<Flex w='100%' justify='space-between' align='center'>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}><Heading size='sm' color='textPrimary'>Rocket Crash</Heading><LobbyDock players={players} /></VStack>
					<Box w='40px' />
				</Flex>
				<VStack spacing={0} py={10} w='100%' align='center' justify='center' minH='350px' position='relative'>
					<Box w={`${chartWidth}px`} h={`${chartHeight}px`} position='relative' borderLeft='2px solid' borderBottom='2px solid' borderColor='border'>
						{[1,2,3,4,5].map(i => (<Box key={i} position='absolute' bottom={`${i*20}%`} left={0} right={0} borderBottom='1px dashed' borderColor='whiteAlpha.100' />))}
						<svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible' }}>
							<defs><linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0A84FF" stopOpacity="0.2" /><stop offset="100%" stopColor="#0A84FF" stopOpacity="1" /></linearGradient></defs>
							<motion.path d={pathData} fill="none" stroke="url(#lineGradient)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />
							<path d={pathData} fill="none" stroke="#0A84FF" strokeWidth="8" strokeLinecap="round" style={{ filter: 'blur(8px)', opacity: 0.3 }} />
						</svg>
						{history.length > 0 && (
							<Box position='absolute' left={`${getX(history[history.length - 1].x)}px`} top={`${getY(history[history.length - 1].y)}px`} transform='translate(-50%, -50%)' zIndex={2}>
								<Box as={motion.div} animate={gameState === 'climbing' ? { rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 0.5 }}>
									<Icon as={IoRocketOutline} boxSize={10} color={gameState === 'crashed' ? 'noAction' : 'primaryAction'} transform='rotate(-45deg)' />
									{gameState === 'climbing' && (<Box as={motion.div} animate={{ opacity: [1, 0], scale: [1, 2] }} transition={{ repeat: Infinity, duration: 0.2 }} position='absolute' bottom='-10px' left='-10px'><Icon as={IoFlame} color='orange.400' boxSize={4} /></Box>)}
								</Box>
							</Box>
						)}
					</Box>
					<VStack spacing={2} mt={10} zIndex={1}>
						<Text fontSize='6xl' fontWeight='900' color={gameState === 'crashed' ? 'noAction' : (isCashedOut ? 'yesAction' : 'textPrimary')} fontFamily='JetBrains Mono'>{multiplier.toFixed(2)}x</Text>
						{gameState === 'crashed' && <Badge colorScheme='red' fontSize='xl' px={4} borderRadius='lg'>CRASHED</Badge>}
						{isCashedOut && <Badge colorScheme='green' fontSize='xl' px={4} borderRadius='lg'>CASHED @ {cashedOutAt.toFixed(2)}x</Badge>}
					</VStack>
				</VStack>
			</VStack>
			<Box w='100%' pt={10}>
				{gameState === 'climbing' ? (
					<Button w='100%' h='72px' colorScheme='green' borderRadius='24px' fontSize='2xl' fontWeight='900' onClick={handleCashOut} isDisabled={isCashedOut} boxShadow='0 12px 24px rgba(48, 209, 88, 0.4)'>{isCashedOut ? 'WAITING...' : `CASH OUT ${(bet * multiplier).toFixed(0)} BT`}</Button>
				) : (
					<VStack w='100%' spacing={6}>
						<HStack w='100%' justify='center' spacing={4}>{[10,50,100,500,1000].map(amt => (<Chip key={amt} amount={amt} active={false} onClick={() => { setBet(prev => prev + amt); triggerHaptic(); }} />))}<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='textSecondary' onClick={() => setBet(0)} aria-label='clear' /></HStack>
						<Button w='100%' h='72px' colorScheme='blue' borderRadius='24px' fontSize='2xl' fontWeight='900' onClick={startRound} isDisabled={bet === 0 || bet > balance} boxShadow='0 12px 24px rgba(10, 132, 255, 0.3)'>BET {bet} BT</Button>
					</VStack>
				)}
			</Box>
		</Flex>
	);
};

export default Crash;
