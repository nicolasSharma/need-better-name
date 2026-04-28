import { useState, useEffect } from 'react';
import { Box, Flex, Text, Badge, Drawer, DrawerBody, DrawerHeader, DrawerOverlay, DrawerContent, useDisclosure, useToast, Input, VStack, HStack, Icon } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Market } from '@/hooks/useMarkets';
import { calcPayouts } from '@/lib/engine';
import { triggerHaptic, triggerAudioPop } from '@/lib/haptics';
import { playThump } from '@/lib/audio';
import SwipeToConfirm from '@/components/SwipeToConfirm';
import { placeBet } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { IoStatsChartOutline } from 'react-icons/io5';

const statusColors: Record<string, string> = {
	open: 'green',
	locked: 'yellow',
	resolved: 'gray',
};

const MarketCard = ({ market }: { market: Market }) => {
	const navigate = useNavigate();
	const payouts = calcPayouts(market.totalPot, market.pools, 0.03);
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [selectedOption, setSelectedOption] = useState<string>('');
	const [betAmount, setBetAmount] = useState('');
	const [loading, setLoading] = useState(false);
	
	const { user } = useAuth();
	const { profile } = useUser();
	const toast = useToast();

	const [myHoldings, setMyHoldings] = useState<Record<string, number>>({});

	useEffect(() => {
		if (!user) return;
		const q = query(collection(db, 'markets', market.id, 'bets'), where('userId', '==', user.uid));
		const unsub = onSnapshot(q, (snap) => {
			const holdings: Record<string, number> = {};
			snap.docs.forEach((doc) => {
				const bet = doc.data();
				const optId = bet.optionId || (bet.side?.toUpperCase());
				holdings[optId] = (holdings[optId] || 0) + bet.amount;
			});
			setMyHoldings(holdings);
		});
		return unsub;
	}, [user, market.id]);

	const handleOpenDrawer = (optionId: string) => {
		triggerHaptic();
		setSelectedOption(optionId);
		onOpen();
	};

	const handleConfirmBet = async () => {
		const amt = parseInt(betAmount) || 0;
		if (!user || amt <= 0) return;
		
		setLoading(true);
		try {
			await placeBet(market.id, user.uid, selectedOption, amt);
			playThump();
			triggerAudioPop();
			toast({ title: `Order Filled: ${amt} BT`, status: 'success', duration: 2000 });
			setBetAmount('');
			onClose();
		} catch (e: any) {
			toast({ title: 'Order Rejected', description: e.message, status: 'error' });
		}
		setLoading(false);
	};

	const handleCardClick = () => {
		triggerHaptic();
		navigate(`/casino/${market.id}`);
	};

	const amt = parseInt(betAmount) || 0;
	const currentPayout = selectedOption ? payouts[selectedOption] : 0;
	const totalPositionValue = Object.values(myHoldings).reduce((a, b) => a + b, 0);

	const isBinary = market.options.length === 2 && 
					 market.options.every(o => o.toUpperCase() === 'YES' || o.toUpperCase() === 'NO');

	return (
		<>
			<Box
				bg='surface'
				borderRadius='16px'
				border='1px solid'
				borderColor='border'
				overflow='hidden'
				shadow='sm'
			>
				<Box p={4} pb={4} onClick={handleCardClick} cursor='pointer' _hover={{ bg: 'surfaceDeep' }} transition='background 0.2s'>
					<Flex justify='space-between' align='center' mb={3}>
						<Text fontSize='10px' color='textSecondary' letterSpacing='widest' fontWeight='700'>
							MARKET CONTRACT
						</Text>
						<Badge colorScheme={statusColors[market.status]} borderRadius='full' px={2} paddingY={0.5} fontSize='9px' variant='subtle'>
							{market.status.toUpperCase()}
						</Badge>
					</Flex>

					<Flex justify='space-between' align='flex-start' mb={5}>
						<Text fontWeight='800' color='textPrimary' fontSize='xl' lineHeight='1.2' maxW='70%'>
							{market.question}
						</Text>
						<VStack align='flex-end' spacing={0}>
							<Text fontSize='9px' color='textSecondary' fontWeight='700'>VOLUME</Text>
							<Text fontSize='xs' color='textPrimary' fontWeight='800' fontFamily='JetBrains Mono'>{(market.totalPot - 50)} BT</Text>
						</VStack>
					</Flex>

					{totalPositionValue > 0 ? (
						<Flex align='center' gap={3} bg='primaryAction' color='white' p={3} borderRadius='12px'>
							<Icon as={IoStatsChartOutline} />
							<Box>
								<Text fontSize='xs' fontWeight='700' opacity={0.8}>YOUR ACTIVE POSITION</Text>
								<Text fontSize='lg' fontWeight='800' fontFamily='JetBrains Mono'>{totalPositionValue} BT</Text>
							</Box>
						</Flex>
					) : (
						<HStack spacing={4} mt={2}>
							<Box flex={1}>
								<Text fontSize='9px' color='textSecondary' fontWeight='700'>POOLS</Text>
								<Text fontSize='md' fontWeight='800' color='textPrimary' fontFamily='JetBrains Mono'>{market.totalPot} BT</Text>
							</Box>
						</HStack>
					)}
				</Box>

				{market.status === 'open' && (
					<Box borderTop='1px solid' borderColor='border'>
						{isBinary ? (
							<Flex>
								{market.options.sort((a) => a.toUpperCase() === 'YES' ? -1 : 1).map((opt) => (
									<Flex
										key={opt}
										flex={1}
										direction='column'
										align='center'
										justify='center'
										bg={opt.toUpperCase() === 'YES' ? 'yesAction' : 'noAction'}
										color='white'
										_hover={{ opacity: 0.9 }}
										_active={{ opacity: 1, filter: 'brightness(80%)' }}
										onClick={() => handleOpenDrawer(opt)}
										cursor='pointer'
										py={4}
										transition='all 0.1s'
										borderRight={opt.toUpperCase() === 'YES' ? '1px solid' : 'none'}
										borderColor='whiteAlpha.200'
									>
										<Text fontWeight='900' fontSize='lg' lineHeight='1'>{opt.toUpperCase()}</Text>
										<Text fontSize='10px' fontWeight='700' mt={1} opacity={0.9}>
											{Math.round(((market.pools[opt] || 0) / market.totalPot) * 100)}% · {payouts[opt]?.toFixed(2)}x
										</Text>
									</Flex>
								))}
							</Flex>
						) : (
							<VStack spacing={0} align='stretch'>
								{market.options.map((opt, idx) => (
									<Flex
										key={opt}
										justify='space-between'
										align='center'
										p={4}
										bg='surface'
										_hover={{ bg: 'surfaceDeep' }}
										_active={{ bg: 'border' }}
										onClick={() => handleOpenDrawer(opt)}
										cursor='pointer'
										borderBottom={idx === market.options.length - 1 ? 'none' : '1px solid'}
										borderColor='border'
									>
										<HStack spacing={3}>
											<Box w='10px' h='10px' borderRadius='full' bg='primaryAction' opacity={0.5 + (idx*0.2)} />
											<Text fontWeight='700' fontSize='sm'>{opt}</Text>
										</HStack>
										<HStack spacing={4}>
											<Text fontSize='xs' fontWeight='800' color='primaryAction' fontFamily='JetBrains Mono'>
												{payouts[opt]?.toFixed(2)}x
											</Text>
											<Badge borderRadius='4px' fontSize='10px' variant='solid' bg='primaryAction' color='white'>
												{Math.round(((market.pools[opt] || 0) / market.totalPot) * 100)}%
											</Badge>
										</HStack>
									</Flex>
								))}
							</VStack>
						)}
					</Box>
				)}
			</Box>

			<Drawer placement='bottom' onClose={onClose} isOpen={isOpen}>
				<DrawerOverlay bg='blackAlpha.600' backdropFilter='blur(4px)' />
				<DrawerContent bg='bg' borderTopRadius='24px' border='1px solid' borderColor='border' borderBottom='none'>
					<DrawerHeader borderBottomWidth='1px' borderColor='border' pt={6}>
						<Flex justify='space-between' align='center'>
							<Box>
								<Text fontSize='10px' color='textSecondary' letterSpacing='widest' fontWeight='700'>ORDER EXECUTION</Text>
								<Text color='primaryAction' fontWeight='900' fontSize='2xl'>
									{selectedOption.toUpperCase()} @ {Math.round(((market.pools[selectedOption] || 0) / market.totalPot) * 100)}%
								</Text>
							</Box>
							<Text fontSize='sm' color='textSecondary' fontFamily='JetBrains Mono' fontWeight='700'>
								BAL: {profile?.balance}
							</Text>
						</Flex>
					</DrawerHeader>
					<DrawerBody py={6} pb={12}>
						<Input
							type='number'
							placeholder='Shares to acquire (BT)'
							value={betAmount}
							onChange={(e) => setBetAmount(e.target.value)}
							size='lg'
							mb={6}
							bg='surface'
							color='textPrimary'
							fontFamily='JetBrains Mono'
							fontSize='2xl'
							fontWeight='900'
							h='70px'
							_focus={{ borderColor: 'primaryAction', boxShadow: 'none' }}
						/>
						
						<Flex justify='space-between' mb={8}>
							<Text color='textSecondary' fontWeight='700'>MODAL POTENTIAL RETURN</Text>
							<Text color='primaryAction' fontFamily='JetBrains Mono' fontWeight='900' fontSize='2xl'>
								{amt > 0 ? Math.floor(amt * currentPayout) : 0} BT
							</Text>
						</Flex>
						
						<SwipeToConfirm 
							onConfirm={handleConfirmBet} 
							isLoading={loading} 
							trackColor={selectedOption.toUpperCase() === 'YES' ? 'yesAction' : selectedOption.toUpperCase() === 'NO' ? 'noAction' : 'primaryAction'} 
						/>
					</DrawerBody>
				</DrawerContent>
			</Drawer>
		</>
	);
};

export default MarketCard;
