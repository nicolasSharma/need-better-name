import { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Flex, Text, keyframes } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useUser, useTransactions, useRoommates } from '@/context/AppDataProvider';
import AnimatedNumber from '@/components/AnimatedNumber';
import { isSystemAdmin } from '@/lib/admin';
import { triggerCoinDrop } from '@/components/CoinDrop';

const marquee = keyframes`
  0% { transform: translateX(100vw); }
  100% { transform: translateX(-100%); }
`;

const balancePulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(10, 132, 255, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(10, 132, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(10, 132, 255, 0); }
`;

const TopNav = () => {
	const { profile } = useUser();
	const { transactions } = useTransactions();
	const { roommates: roommateList } = useRoommates();
	const navigate = useNavigate();
	const [balanceChanged, setBalanceChanged] = useState(false);
	const prevBalance = useRef<number | null>(null);

	// Detect balance changes and pulse
	useEffect(() => {
		if (profile?.balance !== undefined && prevBalance.current !== null && prevBalance.current !== profile.balance) {
			setBalanceChanged(true);
			
			// If balance increased, drop coins!
			if (profile.balance > prevBalance.current) {
				const diff = profile.balance - prevBalance.current;
				triggerCoinDrop(diff);
			}

			const timer = setTimeout(() => setBalanceChanged(false), 1000);
			return () => clearTimeout(timer);
		}
		if (profile?.balance !== undefined) prevBalance.current = profile.balance;
	}, [profile?.balance]);

	const roommates = useMemo(() => {
		const map: Record<string, string> = { house: 'HOUSE' };
		roommateList.forEach(r => { map[r.id] = r.displayName?.split(' ')[0] || 'User'; });
		return map;
	}, [roommateList]);

	const marqueeText = (transactions || []).length > 0 
		? (transactions || []).slice(0, 15).map(tx => {
			if (!tx) return '';
			const name = roommates[tx.userId] || 'UNKNOWN';
			const amt = Math.abs(tx.amount || 0);
			if (tx.description) return `${name}: ${tx.description}`;

			switch(tx.type) {
				case 'bet_placed': return `${name} acquired contract shares (${amt} BT)`;
				case 'bet_payout': return `${name} yielded +${amt} BT from contract`;
				case 'chore_reward': return `${name} secured +${amt} BT from task verification`;
				case 'bounty_reward': return `${name} claimed +${amt} BT`;
				case 'splitwise_settle': return `Physical USD debt cleared by ${name}`;
				case 'tax': return `Network collected +${amt} BT`;
				case 'house_seed': return `Network injected ${amt} BT into new market`;
				case 'perk_purchase': return `${name} destroyed ${amt} BT for a perk`;
				default: return `${name} transferred ${amt} BT`;
			}
		}).filter(Boolean).join('  ✦  ')
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
					cursor='pointer'
					onClick={() => navigate('/profile')}
					_active={{ transform: 'scale(0.95)' }}
					transition='all 0.15s'
					animation={balanceChanged ? `${balancePulse} 1s ease-out` : 'none'}
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
					animation={`${marquee} 60s linear infinite`}
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
