import { useState } from 'react';
import { Box, Flex, Text, VStack, HStack, Button, Heading, useToast, Badge, Center, Grid, GridItem, IconButton } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoArrowBack, IoTrashOutline } from 'react-icons/io5';
import { useAuth } from '@/context/AuthProvider';
import { playCasinoGame } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playWin, playThump, playPlink } from '@/lib/audio';
import Confetti from '@/components/Confetti';
import { useLobby, Chip, LobbyDock, getChipForBet } from './shared';

const SEQ = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const SEGMENT_DEG = 360 / 37;

const segmentColor = (num: number): string => {
	if (num === 0) return '#00a65a';
	return REDS.includes(num) ? '#c0392b' : '#1a1a2e';
};

/* ── Individual wheel segment ── */
const WheelSegment = ({ num, index }: { num: number; index: number }) => {
	const angle = index * SEGMENT_DEG;
	const color = segmentColor(num);

	return (
		<Box
			position='absolute'
			top='0' left='0'
			w='100%' h='100%'
			style={{ transform: `rotate(${angle}deg)` }}
			pointerEvents='none'
		>
			{/* Wedge slice via simple clip-path */}
			<Box
				position='absolute'
				top='0' left='calc(50% - 11.5px)'
				w='23px' h='130px'
				transformOrigin='bottom center'
				style={{
					clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
					background: color,
				}}
			/>
			{/* Divider line rotated to the edge of the wedge */}
			<Box
				position='absolute'
				top='0' left='50%'
				w='1px' h='130px'
				bg='whiteAlpha.300'
				transformOrigin='bottom center'
				style={{ transform: `rotate(${SEGMENT_DEG / 2}deg)` }}
			/>
			{/* Number label positioned perfectly inside the wedge */}
			<Box
				position='absolute'
				top='10px'
				left='50%'
				transform='translateX(-50%)'
				pointerEvents='none'
			>
				<Text
					color='white'
					fontSize='10px'
					fontWeight='900'
					textAlign='center'
					textShadow='0 1px 3px rgba(0,0,0,0.9)'
					lineHeight='1'
				>
					{num}
				</Text>
			</Box>
		</Box>
	);
};

/* ── The full roulette wheel ── */
const RouletteWheel = ({ rotation, spinning, resultText }: { rotation: number; spinning: boolean; resultText: string }) => (
	<Center h='300px' w='300px' position='relative'>
		{/* Outer ring / bezel */}
		<Box
			w='290px' h='290px'
			borderRadius='full'
			bgGradient='linear(135deg, #5a3e28, #3d2b1f, #5a3e28)'
			boxShadow='0 0 30px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.4)'
			display='flex' alignItems='center' justifyContent='center'
			border='3px solid'
			borderColor='#D4AF37'
		>
			{/* Track ring */}
			<Box
				w='274px' h='274px'
				borderRadius='full'
				bg='#2a1f14'
				boxShadow='inset 0 0 15px rgba(0,0,0,0.7)'
				display='flex' alignItems='center' justifyContent='center'
			>
				{/* Spinning wheel body */}
				<Box
					as={motion.div}
					animate={{ rotate: -rotation }}
					transition={{ duration: 10, ease: [0.15, 0, 0.15, 1] }}
					w='260px' h='260px'
					borderRadius='full'
					position='relative'
					overflow='hidden'
					boxShadow='0 0 10px rgba(0,0,0,0.5)'
					border='2px solid #3d2b1f'
				>
					{/* Background fill for segments */}
					<Box position='absolute' top='0' left='0' w='100%' h='100%' bg='#1a1a2e' borderRadius='full' />
					{/* Render each segment */}
					{SEQ.map((num, i) => (
						<WheelSegment key={`seg-${i}`} num={num} index={i} />
					))}
					{/* Center hub */}
					<Box
						position='absolute' top='50%' left='50%'
						transform='translate(-50%,-50%)'
						w='70px' h='70px'
						borderRadius='full'
						bgGradient='radial(#D4AF37, #8a6d3b)'
						border='5px solid #3d2b1f'
						boxShadow='0 0 15px rgba(212,175,55,0.3), inset 0 0 10px rgba(0,0,0,0.3)'
						zIndex={5}
					/>
					{/* Inner decorative ring */}
					<Box
						position='absolute' top='50%' left='50%'
						transform='translate(-50%,-50%)'
						w='90px' h='90px'
						borderRadius='full'
						border='2px solid'
						borderColor='#D4AF3766'
						zIndex={4}
					/>
				</Box>
			</Box>
		</Box>
		{/* Gold pointer triangle at top */}
		<Box
			position='absolute' top='2px' left='50%'
			transform='translateX(-50%)'
			w='0' h='0'
			borderLeft='10px solid transparent'
			borderRight='10px solid transparent'
			borderTop='22px solid #D4AF37'
			zIndex={10}
			filter='drop-shadow(0 2px 6px rgba(0,0,0,0.6))'
		/>

		{/* Centered Result Overlay */}
		<AnimatePresence>
			{resultText && !spinning && (
				<Box
					as={motion.div}
					initial={{ scale: 0, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0, opacity: 0 }}
					position='absolute'
					zIndex={20}
					textAlign='center'
					pointerEvents='none'
				>
					<Badge
						colorScheme={resultText.includes('WON') ? 'green' : 'red'}
						fontSize='3xl'
						p={6}
						borderRadius='2xl'
						boxShadow='dark-lg'
						border='4px solid white'
					>
						{resultText}
					</Badge>
				</Box>
			)}
		</AnimatePresence>
	</Center>
);

const Roulette = ({ onExit, balance }: { onExit: () => void; balance: number }) => {
	const { user } = useAuth();
	const { players, toggleReady, resetLobbyReady, isMultiplayer, allReady, myReady } = useLobby('roulette');
	const toast = useToast();
	const [spinning, setSpinning] = useState(false);
	const [result, setResult] = useState<number | null>(null);
	const [activeChip, setActiveChip] = useState(50);
	const [bets, setBets] = useState<Record<string, number>>({});
	const [rotation, setRotation] = useState(0);
	const [resultText, setResultText] = useState('');
	const [confetti, setConfetti] = useState(false);
	const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);

	const spin = () => {
		if (spinning || totalBet === 0 || (isMultiplayer && !allReady)) return;
		// Re-validate balance before every spin
		if (balance < totalBet) {
			toast({ title: 'Insufficient balance', description: `You need ${totalBet} BT but only have ${balance} BT.`, status: 'error', duration: 3000 });
			return;
		}
		setSpinning(true); setResult(null); setResultText(''); setConfetti(false);
		triggerHaptic(); playPlink(); resetLobbyReady();
		const targetNum = SEQ[Math.floor(Math.random() * SEQ.length)];
		const targetIdx = SEQ.indexOf(targetNum);
		const extra = 4 + Math.floor(Math.random() * 2);
		
		const baseTarget = targetIdx * SEGMENT_DEG + SEGMENT_DEG / 2;
		const currentFullSpins = Math.floor(rotation / 360);
		const nextRotation = (currentFullSpins + extra) * 360 + baseTarget;
		
		setRotation(nextRotation);
		setTimeout(() => resolve(targetNum), 10200);
	};

	const resolve = async (targetNum: number) => {
		setResult(targetNum); setSpinning(false);
		let payout = 0;
		// Green (0) pays 35:1 → 36× total return
		if (bets['green'] && targetNum === 0) payout += bets['green'] * 36;
		if (bets['red'] && REDS.includes(targetNum)) payout += bets['red'] * 2;
		if (bets['black'] && !REDS.includes(targetNum) && targetNum !== 0) payout += bets['black'] * 2;
		// Straight number bets pay 35:1 → 36× total return
		Object.keys(bets).forEach(k => { if (k.startsWith('num_') && parseInt(k.split('_')[1]) === targetNum) payout += bets[k] * 36; });
		if (payout > 0) { setResultText(`YOU WON ${payout} BT!`); setConfetti(true); playWin(); }
		else { setResultText('YOU LOST'); playThump(); }
		await playCasinoGame(user!.uid, totalBet, payout, 'roulette', `Roulette: Landed ${targetNum}`);
		// Clear bets after each spin completes
		setBets({});
	};

	const placeBet = (key: string) => { if (spinning) return; triggerHaptic(); playPlink(); setBets(p => ({ ...p, [key]: (p[key] || 0) + activeChip })); };

	return (
		<Flex direction='column' w='100%' minH='calc(100vh - 120px)'>
			<VStack spacing={6} w='100%' flex={1}>
				<Confetti fire={confetti} />
				<Flex w='100%' justify='space-between' align='center'>
					<IconButton icon={<IoArrowBack />} onClick={onExit} variant='ghost' aria-label='back' />
					<VStack spacing={1}><Heading size='sm' color='textPrimary'>Roulette Table</Heading><LobbyDock players={players} userId={user?.uid} onToggleReady={toggleReady} /></VStack>
					<Box w='40px' />
				</Flex>
				<RouletteWheel rotation={rotation} spinning={spinning} resultText={resultText} />
				<Box w='100%' bg='green.800' p={4} borderRadius='12px' border='4px solid' borderColor='#D4AF37' boxShadow='2xl' position='relative'>
					<HStack spacing={0} h='180px'>
						<Flex w='40px' h='100%' bg='green.500' border='1px solid white' align='center' justify='center' onClick={() => placeBet('green')} cursor='pointer' position='relative' borderTopLeftRadius='xl' borderBottomLeftRadius='xl' bgGradient={result === 0 ? 'radial(whiteAlpha.400, transparent)' : 'none'} borderColor={result === 0 ? 'yellow.400' : 'whiteAlpha.400'} borderWidth={result === 0 ? '3px' : '1px'}><Text color='white' fontWeight='900' transform='rotate(-90deg)'>0</Text>{bets['green'] && <Box position='absolute' top='50%' left='50%' transform='translate(-50%,-50%)'><Chip amount={getChipForBet(bets['green'])} active={false} onClick={()=>{}} /></Box>}</Flex>
						<Grid templateRows='repeat(3, 1fr)' templateColumns='repeat(12, 1fr)' flex={1} h='100%'>
							{Array.from({length: 36}).map((_, i) => { const num = (Math.floor(i/3)*3)+(i%3)+1; const isRed = REDS.includes(num); const isW = result === num; return (<GridItem key={num} border='1px solid' borderColor='whiteAlpha.400'><Flex h='100%' bg={isRed ? 'red.600' : 'black'} align='center' justify='center' onClick={() => placeBet(`num_${num}`)} cursor='pointer' position='relative' bgGradient={isW ? 'radial(whiteAlpha.600, transparent)' : 'none'} borderColor={isW ? 'yellow.400' : 'whiteAlpha.400'} borderWidth={isW ? '3px' : '1px'} transition='0.3s'><Text color='white' fontSize='xs' fontWeight='900'>{num}</Text>{bets[`num_${num}`] && (<Box position='absolute' top='50%' left='50%' transform='translate(-50%,-50%) scale(0.6)'><Chip amount={getChipForBet(bets[`num_${num}`])} active={false} onClick={()=>{}} /></Box>)}</Flex></GridItem>); })}
						</Grid>
					</HStack>
					<HStack mt={4} spacing={2}>
						<Button flex={1} h='50px' bg='red.600' color='white' _hover={{bg:'red.700'}} onClick={() => placeBet('red')} position='relative' borderRadius='xl'>RED (2x){bets['red'] && <Box position='absolute' top='-10px' right='-10px' transform='scale(0.5)'><Chip amount={getChipForBet(bets['red'])} active={false} onClick={()=>{}}/></Box>}</Button>
						<Button flex={1} h='50px' bg='black' color='white' _hover={{bg:'gray.900'}} onClick={() => placeBet('black')} position='relative' borderRadius='xl' border='1px solid' borderColor='whiteAlpha.300'>BLACK (2x){bets['black'] && <Box position='absolute' top='-10px' right='-10px' transform='scale(0.5)'><Chip amount={getChipForBet(bets['black'])} active={false} onClick={()=>{}}/></Box>}</Button>
					</HStack>
				</Box>
			</VStack>
			<Box w='100%' pt={10}>
				<VStack w='100%'>
					<HStack w='100%' justify='center' spacing={4} mb={6}>{[10,50,100,500].map(amt => (<Chip key={amt} amount={amt} active={activeChip === amt} onClick={() => { setActiveChip(amt); triggerHaptic(); }} />))}<IconButton icon={<IoTrashOutline />} size='sm' variant='ghost' color='whiteAlpha.600' onClick={() => setBets({})} aria-label='clear' /></HStack>
					{isMultiplayer && !allReady && <Button w='100%' h='50px' variant='ghost' colorScheme={myReady ? 'green' : 'yellow'} onClick={() => toggleReady(!myReady)} mb={2}>{myReady ? 'READY!' : 'READY UP'}</Button>}
					<Button w='100%' h='60px' colorScheme={allReady ? 'green' : 'gray'} size='lg' fontSize='xl' fontWeight='900' isDisabled={spinning || totalBet === 0 || (isMultiplayer && !allReady)} onClick={spin} borderRadius='24px' boxShadow={allReady ? '0 10px 20px rgba(56, 161, 105, 0.3)' : 'none'} _active={{ transform: 'scale(0.98)' }}>{isMultiplayer && !allReady ? 'WAITING FOR PLAYERS...' : 'SPIN WHEEL'}</Button>
				</VStack>
			</Box>
		</Flex>
	);
};

export default Roulette;
