import { useState, lazy, Suspense } from 'react';
import { Box, Flex, Text, VStack, HStack, Heading, Icon, IconButton } from '@chakra-ui/react';
import { IoArrowBack, IoHandLeft, IoDice, IoInfinite, IoDiamondOutline, IoRocketOutline, IoChevronForward, IoSpeedometerOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/AppDataProvider';
import { triggerHaptic } from '@/lib/haptics';
import Skeleton from '@/components/Skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

const Blackjack = lazy(() => import('./games/Blackjack'));
const Roulette = lazy(() => import('./games/Roulette'));
const HigherLower = lazy(() => import('./games/HigherLower'));
const Mines = lazy(() => import('./games/Mines'));
const Crash = lazy(() => import('./games/Crash'));
const HorseRacing = lazy(() => import('./games/HorseRacing'));

const GameFallback = () => (
	<VStack spacing={4} p={8} pt={20}>
		<Skeleton h='60px' w='100%' borderRadius='16px' />
		<Skeleton h='300px' w='100%' borderRadius='24px' />
		<Skeleton h='60px' w='100%' borderRadius='16px' />
	</VStack>
);

const GamesPage = () => {
	const navigate = useNavigate();
	const { profile } = useUser();
	const [activeGame, setActiveGame] = useState<'none' | 'blackjack' | 'roulette' | 'streak' | 'mines' | 'crash' | 'race'>('none');

	const games = [
		{ id: 'blackjack', name: 'Blackjack', icon: IoHandLeft, color: 'green.500', desc: 'Beat the dealer to 21' },
		{ id: 'roulette', name: 'Roulette', icon: IoDice, color: 'red.500', desc: 'Single-zero classic' },
		{ id: 'streak', name: 'High / Low', icon: IoInfinite, color: 'blue.500', desc: 'Build a streak multiplier' },
		{ id: 'mines', name: 'Mines', icon: IoDiamondOutline, color: 'orange.400', desc: 'Find gems, avoid mines' },
		{ id: 'crash', name: 'Crash', icon: IoRocketOutline, color: 'purple.500', desc: 'Cash out before the rocket blows' },
		{ id: 'race', name: 'Derby Racing', icon: IoSpeedometerOutline, color: 'orange.500', desc: 'Top-down virtual horse racing simulator' },
	];

	if (activeGame !== 'none') {
		const bal = profile?.balance || 0;
		const exit = () => setActiveGame('none');
		return (
			<Box minH='100vh' bg='bg' p={4} pt='env(safe-area-inset-top, 0px)'>
				<ErrorBoundary fallbackTitle='Game crashed'>
					<Suspense fallback={<GameFallback />}>
						{activeGame === 'blackjack' && <Blackjack onExit={exit} balance={bal} />}
						{activeGame === 'roulette' && <Roulette onExit={exit} balance={bal} />}
						{activeGame === 'streak' && <HigherLower onExit={exit} balance={bal} />}
						{activeGame === 'mines' && <Mines onExit={exit} balance={bal} />}
						{activeGame === 'crash' && <Crash onExit={exit} balance={bal} />}
						{activeGame === 'race' && <HorseRacing onExit={exit} balance={bal} />}
					</Suspense>
				</ErrorBoundary>
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

export default GamesPage;
