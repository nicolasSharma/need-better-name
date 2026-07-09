import { useState, useEffect } from 'react';
import {
	Box, Flex, Text, VStack, HStack, Avatar, Icon, Center,
	IconButton
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthProvider';
import { useUser } from '@/context/AppDataProvider';
import { doc, setDoc, onSnapshot, serverTimestamp, deleteField, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

// --- LOBBY SYSTEM ---
export const useLobby = (gameId: string) => {
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
				return now - last < 120000; // 2 minute stale window (up from 30s)
			});
			setPlayers(active);
		});

		// Pulse Presence every 10s (down from 15s)
		const interval = setInterval(() => {
			updateDoc(lobbyRef, {
				[`players.${user.uid}.lastActive`]: serverTimestamp()
			}).catch(() => {}); // Swallow errors if lobby doc deleted
		}, 10000);

		return () => {
			unsub();
			clearInterval(interval);
			updateDoc(lobbyRef, {
				[`players.${user.uid}`]: deleteField()
			}).catch(() => {});
		};
	}, [user, gameId, profile?.displayName]);

	const toggleReady = (isReady: boolean) => {
		if (!user || !gameId) return;
		const lobbyRef = doc(db, 'lobbies', gameId);
		updateDoc(lobbyRef, {
			[`players.${user.uid}.ready`]: isReady
		}).catch(() => {});
	};

	const resetLobbyReady = () => {
		if (!user || !gameId) return;
		const lobbyRef = doc(db, 'lobbies', gameId);
		const updates: any = {};
		players.forEach(p => {
			updates[`players.${p.id}.ready`] = false;
		});
		updateDoc(lobbyRef, updates).catch(() => {});
	};

	const isMultiplayer = players.length > 1;
	const allReady = !isMultiplayer || players.every(p => p.ready);
	const myReady = players.find(p => p.id === user?.uid)?.ready || false;

	return { players, toggleReady, resetLobbyReady, isMultiplayer, allReady, myReady };
};

// --- CHIP COMPONENT ---
export const Chip = ({ amount, active, onClick, disabled }: { amount: number, active: boolean, onClick: () => void, disabled?: boolean }) => {
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
export const LobbyDock = ({ players, onToggleReady, userId }: { players: any[], onToggleReady?: (r: boolean) => void, userId?: string }) => (
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

// --- CARD UI COMPONENT ---
export const CardUI = ({ card, hidden, index }: { card: any; hidden?: boolean; index: number }) => {
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

// --- UTILS ---
export const getChipForBet = (amount: number) => {
	if (amount >= 1000) return 1000;
	if (amount >= 500) return 500;
	if (amount >= 100) return 100;
	if (amount >= 50) return 50;
	return 10;
};
