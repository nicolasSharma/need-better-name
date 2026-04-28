import { useState } from 'react';
import { Box, Button, Input, Flex, Text, useToast, Select, Badge } from '@chakra-ui/react';
import { placeBet } from '@/lib/firestore';
import { calcPayouts } from '@/lib/engine';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import type { Market } from '@/hooks/useMarkets';

interface Props {
	market: Market;
}

const BetSlip = ({ market }: Props) => {
	const { user } = useAuth();
	const { profile } = useUser();
	const toast = useToast();
	const [selectedOption, setSelectedOption] = useState(market.options[0]);
	const [amount, setAmount] = useState('');
	const [loading, setLoading] = useState(false);

	const amt = parseInt(amount) || 0;
	
	// Simulation logic for N-options
	const currentPools = { ...market.pools };
	currentPools[selectedOption] = (currentPools[selectedOption] || 0) + amt;
	const simPayouts = calcPayouts(market.totalPot + amt, currentPools, 0.03);
	const myPayout = simPayouts[selectedOption];

	const handleBet = async () => {
		if (!user || amt <= 0) return;
		setLoading(true);
		try {
			await placeBet(market.id, user.uid, selectedOption, amt);
			toast({ title: `Order Filled: ${amt} BT`, status: 'success', duration: 2000 });
			setAmount('');
		} catch (e: any) {
			toast({ title: 'Bet failed', description: e.message, status: 'error' });
		}
		setLoading(false);
	};

	if (market.status !== 'open') return null;

	return (
		<Box>
			<Text fontSize='11px' color='textSecondary' fontWeight='800' mb={2} textTransform='uppercase' letterSpacing='widest'>
				Select Transaction Position
			</Text>

			<Select 
				value={selectedOption} 
				onChange={(e) => setSelectedOption(e.target.value)} 
				mb={4} 
				bg='bg' 
				borderRadius='10px'
				fontWeight='700'
			>
				{market.options.map(opt => (
					<option key={opt} value={opt}>{opt.toUpperCase()} (Payout: {market.pools[opt] ? calcPayouts(market.totalPot, market.pools, 0.03)[opt].toFixed(2) : '??'}x)</option>
				))}
			</Select>

			<Input
				placeholder='Amount to Stake (BT)'
				type='number'
				value={amount}
				onChange={(e) => setAmount(e.target.value)}
				mb={4}
				bg='bg'
				fontFamily='JetBrains Mono'
				fontWeight='900'
				h='50px'
			/>

			{amt > 0 && (
				<Box bg='bg' borderRadius='12px' p={4} mb={4} border='1px solid' borderColor='border' shadow='inner'>
					<Flex justify='space-between' align='center'>
						<Box>
							<Text fontSize='10px' color='textSecondary' fontWeight='700'>EXPECTED PAYOUT</Text>
							<Text fontSize='lg' color='primaryAction' fontWeight='900' fontFamily='JetBrains Mono'>
								{myPayout.toFixed(2)}x
							</Text>
						</Box>
						<Box textAlign='right'>
							<Text fontSize='10px' color='textSecondary' fontWeight='700'>NET RETURN</Text>
							<Text fontSize='lg' color='primaryAction' fontWeight='900' fontFamily='JetBrains Mono'>
								{Math.floor(amt * myPayout)} BT
							</Text>
						</Box>
					</Flex>
				</Box>
			)}

			<Button
				w='100%'
				variant='primary'
				onClick={handleBet}
				h='55px'
				isLoading={loading}
				isDisabled={amt <= 0 || amt > (profile?.balance || 0)}
			>
				Confirm Order
			</Button>

			{profile && (
				<Flex justify='center' mt={3}>
					<Badge variant='outline' colorScheme={amt > profile.balance ? 'red' : 'green'} borderRadius='full' px={3}>
						Wallet: {profile.balance} BT
					</Badge>
				</Flex>
			)}
		</Box>
	);
};

export default BetSlip;
