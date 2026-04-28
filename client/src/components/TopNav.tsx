import { useState, useEffect } from 'react';
import { Box, Flex, Text, keyframes } from '@chakra-ui/react';
import { useUser } from '@/hooks/useUser';
import { useTransactions } from '@/hooks/useTransactions';
import AnimatedNumber from '@/components/AnimatedNumber';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

const marquee = keyframes`
  0% { transform: translateX(100vw); }
  100% { transform: translateX(-100%); }
`;

const TopNav = () => {
	const { profile } = useUser();
	const { transactions } = useTransactions(true);
	const [roommates, setRoommates] = useState<Record<string, string>>({});

	useEffect(() => {
		const fetchUsers = async () => {
			try {
				const snap = await getDocs(collection(db, 'users'));
				const map: Record<string, string> = {};
				snap.docs.forEach(d => { 
					const data = d.data();
					if (data.displayName) {
						map[d.id] = data.displayName.split(' ')[0]; 
					} else {
						map[d.id] = 'User';
					}
				});
				map['house'] = 'HOUSE';
				setRoommates(map);
			} catch (e) {
				console.error("TopNav fetch error", e);
			}
		};
		fetchUsers();
	}, []);

	const marqueeText = transactions.length > 0 
		? transactions.slice(0, 15).map(tx => {
			const name = roommates[tx.userId] || 'UNKNOWN';
			const amt = Math.abs(tx.amount);
			switch(tx.type) {
				case 'bet_placed': return `[TRADE] ${name} acquired contract shares (${amt} BT)`;
				case 'bet_payout': return `[PAYOUT] ${name} yielded +${amt} BT from contract`;
				case 'chore_reward': return `[MINED] ${name} secured +${amt} BT from task verification`;
				case 'bounty_reward': return `[BOUNTY] ${name} claimed +${amt} BT`;
				case 'splitwise_settle': return `[SETTLEMENT] Physical USD debt cleared by ${name}`;
				case 'tax': return `[TAX] Network collected +${amt} BT`;
				case 'house_seed': return `[LIQUIDITY] Network injected ${amt} BT into new market`;
				case 'perk_purchase': return `[BURN] ${name} destroyed ${amt} BT for a perk`;
				default: return `[TX] ${name} transferred ${amt} BT`;
			}
		}).join('  ✦  ')
		: 'MARKET OPEN... AWAITING NETWORK ACTIVITY...';

	return (
		<Box 
			position='fixed' 
			top={0} 
			left={0} 
			right={0} 
			h='calc(48px + env(safe-area-inset-top, 0px))' 
			pt='env(safe-area-inset-top, 0px)'
			bg='rgba(255, 255, 255, 0.8)' 
			_dark={{ bg: 'rgba(0, 0, 0, 0.8)' }}
			backdropFilter='blur(10px)'
			borderBottom='1px solid' 
			borderColor='border' 
			zIndex={1000}
			display='flex'
		>
			<Flex 
				align='center' 
				px={3} 
				zIndex={2}
				minW='max-content'
			>
				<Flex 
					bg='surface' 
					px={3} 
					py={1} 
					borderRadius='full' 
					border='1px solid' 
					borderColor='border'
					align='center'
					boxShadow='sm'
				>
					<Text fontSize='9px' color='primaryAction' fontWeight='900' mr={1.5} letterSpacing='tighter'>BT</Text>
					<Text fontSize='xs' fontWeight='900' color='textPrimary' fontFamily='JetBrains Mono'>
						<AnimatedNumber value={profile?.balance || 0} />
					</Text>
				</Flex>
			</Flex>

			<Box overflow='hidden' whiteSpace='nowrap' flex={1} position='relative' display='flex' alignItems='center' borderLeft='1px solid' borderColor='border'>
				<Box 
					as='div' 
					animation={`${marquee} 35s linear infinite`}
					display='inline-block'
					pl='100%'
				>
					<Text 
						fontFamily='JetBrains Mono' 
						fontSize='10px' 
						fontWeight='800' 
						color={transactions.length > 0 ? 'primaryAction' : 'textSecondary'}
						textTransform='uppercase'
						letterSpacing='widest'
					>
						{marqueeText}
					</Text>
				</Box>
			</Box>
		</Box>
	);
};

export default TopNav;
