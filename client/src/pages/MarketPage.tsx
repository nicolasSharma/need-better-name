import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Heading, Text, Flex, VStack, Badge, Button, Divider, useToast, HStack, Icon, Select } from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMarket } from '@/hooks/useMarket';
import { useAuth } from '@/context/AuthProvider';
import { useUser, useRoommates } from '@/context/AppDataProvider';
import { resolveMarket, challengeResolution, resolveDispute } from '@/lib/services';
import { calcPayouts } from '@/lib/engine';
import BetSlip from '@/components/BetSlip';
import { IoArrowBack, IoTrendingUpOutline, IoTimeOutline, IoWarningOutline, IoShareOutline } from 'react-icons/io5';
import { isSystemAdmin } from '@/lib/admin';

const statusColors: Record<string, string> = { open: 'green', locked: 'yellow', resolved: 'gray', pending_resolution: 'orange', disputed: 'red' };

const useCountdown = (deadline: any) => {
	const [timeLeft, setTimeLeft] = useState('');
	const [expired, setExpired] = useState(false);
	useEffect(() => {
		if (!deadline) { setTimeLeft(''); setExpired(false); return; }
		const target = typeof deadline.toDate === 'function' ? deadline.toDate().getTime() : new Date(deadline).getTime();
		const tick = () => {
			const diff = target - Date.now();
			if (diff <= 0) { setTimeLeft('Expired'); setExpired(true); return; }
			const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
			setTimeLeft(`${h}h ${m}m ${s}s`);
		};
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [deadline]);
	return { timeLeft, expired };
};
const palette = ['#30D158', '#0A84FF', '#BF5AF2', '#FF9F0A', '#FF453A', '#64D2FF'];

// Multi-Trace Step-Graph Component
const ProbabilityGraph = ({ market, bets }: { market: any, bets: any[] }) => {
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	const options = market.options || ['YES', 'NO'];

	// Reconstruct probability timelines for ALL options
	const { dataPoints, minTz, maxTz } = useMemo(() => {
		const sorted = [...bets].sort((a,b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
		const anchorTz = sorted.length > 0 ? sorted[0].createdAt.toMillis() : Date.now() - 3600000;
		
		const currentPools: Record<string, number> = {};
		options.forEach(opt => {
			currentPools[opt] = market.houseSeedPerOption || 50; 
		});

		const points: any[] = [];
		const pushPoint = (tz: number) => {
			const total = Object.values(currentPools).reduce((a, b) => a + b, 0) || 1;
			const probs: Record<string, number> = {};
			options.forEach(o => probs[o] = (currentPools[o] || 0) / total);
			points.push({ probs, tz });
		};

		pushPoint(anchorTz);

		sorted.forEach(b => {
			if (b.isHouseSeed) return; // Skip seed bets in iteration as they are the anchor
			const optId = b.optionId || b.side?.toUpperCase() || 'UNKNOWN';
			currentPools[optId] = (currentPools[optId] || 0) + b.amount;
			pushPoint(b.createdAt?.toMillis() || anchorTz);
		});

		const now = Date.now();
		let maxBound = market.status === 'resolved' ? points[points.length - 1].tz : now;
		if (maxBound <= anchorTz) maxBound = anchorTz + 3600000;
		
		// Add final point for current state
		const pools = market.pools as Record<string, number>;
		const finalTotal = Object.values(pools).reduce((a, b) => a + b, 0) || 1;
		const finalProbs: Record<string, number> = {};
		options.forEach(o => finalProbs[o] = (pools[o] || 0) / finalTotal);
		points.push({ probs: finalProbs, tz: maxBound });

		return { dataPoints: points, minTz: anchorTz, maxTz: maxBound };
	}, [bets, market, options]);

	const height = 250;
	const width = 1000;
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

	const handleMouseMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
		if (!svgRef.current) return;
		const rect = svgRef.current.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		setMousePos({ x: clientX - rect.left, y: clientY - rect.top });
		
		const targetTz = minTz + (ratio * (maxTz - minTz));
		
		let closest = 0;
		for (let i = 0; i < dataPoints.length; i++) {
			if (dataPoints[i].tz <= targetTz) closest = i;
			else break;
		}
		setHoverIndex(closest);
	};

	const paths = options.map((opt, optIdx) => {
		let path = '';
		dataPoints.forEach((d, i) => {
			const x = ((d.tz - minTz) / (maxTz - minTz)) * width;
			const y = height - (d.probs[opt] * height);
			if (i === 0) path += `${x},${y}`;
			else {
				const prevY = height - (dataPoints[i-1].probs[opt] * height);
				path += ` ${x},${prevY} ${x},${y}`;
			}
		});
		return path;
	});

	return (
		<Box position='relative' w='100%' h={`${height}px`} mb={10} mt={6}>
			<AnimatePresence>
				{hoverIndex !== null && (
					<Box 
						position='absolute' 
						top={-10} 
						left={`${(mousePos.x / (svgRef.current?.clientWidth || 1)) * 100}%`}
						transform='translateX(-50%) translateY(-100%)'
						zIndex={10} 
						bg='rgba(255,255,255,0.9)' 
						_dark={{ bg: 'rgba(28,28,30,0.9)' }}
						backdropFilter='blur(8px)'
						p={3} 
						borderRadius='14px' 
						border='1px solid' 
						borderColor='border' 
						shadow='2xl'
						pointerEvents='none'
						as={motion.div}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
					>
						<VStack align='flex-start' spacing={2}>
							<Text fontSize='9px' fontWeight='900' color='textSecondary' textTransform='uppercase' letterSpacing='widest'>
								Market Odds
							</Text>
							{options.map((opt, i) => (
								<HStack key={opt} spacing={3} w='100%' justify='space-between'>
									<HStack spacing={2}>
										<Box w='8px' h='8px' borderRadius='full' bg={palette[i % palette.length]} />
										<Text fontSize='xs' fontWeight='800' color='textPrimary'>{opt}</Text>
									</HStack>
									<Text fontSize='xs' fontWeight='900' color='textPrimary' fontFamily='JetBrains Mono'>
										{Math.round(dataPoints[hoverIndex].probs[opt] * 100)}%
									</Text>
								</HStack>
							))}
						</VStack>
					</Box>
				)}
			</AnimatePresence>

			<svg 
				ref={svgRef}
				viewBox={`0 0 ${width} ${height}`} 
				style={{ width: '100%', height: '100%', cursor: 'crosshair', overflow: 'visible', touchAction: 'none' }}
				onMouseMove={handleMouseMove}
				onTouchMove={handleMouseMove}
				onMouseLeave={() => setHoverIndex(null)}
				onTouchEnd={() => setHoverIndex(null)}
				preserveAspectRatio="none"
			>
				{[0.25, 0.5, 0.75].map(tick => (
					<line key={tick} x1="0" y1={height * tick} x2={width} y2={height * tick} stroke="rgba(128,128,128,0.1)" strokeDasharray="4 4" />
				))}

				{paths.map((p, i) => (
					<polyline key={i} points={p} fill="none" stroke={palette[i % palette.length]} strokeWidth="3" strokeLinejoin="round" opacity={hoverIndex === null ? 1 : 0.4} />
				))}

				{hoverIndex !== null && (
					<>
						<line 
							x1={((dataPoints[hoverIndex].tz - minTz) / (maxTz - minTz)) * width} 
							y1="0" 
							x2={((dataPoints[hoverIndex].tz - minTz) / (maxTz - minTz)) * width} 
							y2={height} 
							stroke="rgba(128,128,128,0.5)" 
							strokeWidth="1.5" 
							strokeDasharray="4 4"
						/>
						{options.map((opt, i) => (
							<circle 
								key={opt}
								cx={((dataPoints[hoverIndex].tz - minTz) / (maxTz - minTz)) * width}
								cy={height - (dataPoints[hoverIndex].probs[opt] * height)}
								r="5"
								fill={palette[i % palette.length]}
								stroke="white"
								strokeWidth="2"
							/>
						))}
					</>
				)}
			</svg>
		</Box>
	);
};

const MarketPage = () => {
	const { id } = useParams<{ id: string }>();
	const { market, bets, loading } = useMarket(id || '');
	const { user } = useAuth();
	const navigate = useNavigate();
	const toast = useToast();
	const { profile } = useUser();
	const { roommates } = useRoommates();

	const [settleOutcome, setSettleOutcome] = useState('');

	const { timeLeft: challengeTimeLeft, expired: challengeExpired } = useCountdown(market?.challengeDeadline);
	const { timeLeft: expiryTimeLeft, expired: marketExpired } = useCountdown(market?.expiresAt);

	if (loading || !market) return <Box p={8}><Text>Syncing Exchange...</Text></Box>;

	const payouts = calcPayouts(market.totalPot, market.pools, 0.03);
	const isCreatorOrAdmin = market.creatorId === user?.uid || profile?.isAdmin;
	const totalVolume = bets.filter(b => !b.isHouseSeed).reduce((acc, b) => acc + b.amount, 0);

	// User position
	const myHoldings: Record<string, number> = {};
	bets.filter(b => b.userId === user?.uid).forEach(b => {
		const optId = b.optionId || b.side?.toUpperCase() || 'UNKNOWN';
		myHoldings[optId] = (myHoldings[optId] || 0) + b.amount;
	});

	const handleResolve = async () => {
		if (!settleOutcome || !user) return;
		try {
			await resolveMarket(market.id, settleOutcome);
			toast({ title: 'Market resolved! A 24hr challenge window is now open.', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	const handleChallenge = async () => {
		if (!user) return;
		try {
			await challengeResolution(market.id, user.uid);
			toast({ title: 'Challenge filed! An impartial reviewer has been assigned.', status: 'info' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	const handleDisputeResolve = async () => {
		if (!settleOutcome || !user) return;
		try {
			await resolveDispute(market.id, settleOutcome, user.uid);
			toast({ title: 'Dispute resolved!', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};


	const isBettor = bets.some(b => b.userId === user?.uid && !b.isHouseSeed);
	const canChallenge = market.status === 'resolved' && market.challengeDeadline && !challengeExpired && isBettor && market.creatorId !== user?.uid;
	const isDisputeReviewer = market.status === 'disputed' && market.reviewerId === user?.uid;

	return (
		<Box p={8} maxW='800px' mx='auto'>
			<Flex justify='space-between' align='center' mb={8}>
				<Button leftIcon={<IoArrowBack />} variant='ghost' size='sm' onClick={() => navigate('/casino')} color='textSecondary'>
					Back to Exchange
				</Button>
				<Button
					size='sm'
					variant='surface'
					leftIcon={<IoShareOutline />}
					onClick={async () => {
						const url = window.location.href;
						if (navigator.share) {
							try {
								await navigator.share({
									title: market.question,
									text: `Check out this market on The Hub!`,
									url: url
								});
							} catch (e) {
								console.error('Share failed', e);
							}
						} else {
							navigator.clipboard.writeText(url);
							toast({ title: 'Link copied!', status: 'success', duration: 1500 });
						}
					}}
				>
					Share
				</Button>
			</Flex>

			<Box mb={8}>
				<Heading size='2xl' fontWeight='900' color='textPrimary' mb={3}>{market.question}</Heading>
				<HStack spacing={4} flexWrap='wrap'>
					<Badge colorScheme={statusColors[market.status] || 'gray'} borderRadius='6px' px={2} py={1}>
						{market.status === 'pending_resolution' ? 'PENDING RESOLUTION' : market.status === 'disputed' ? 'DISPUTED' : market.status.toUpperCase()}
					</Badge>
					<Text fontSize='sm' color='textSecondary' fontWeight='700' fontFamily='JetBrains Mono'>VOL: {totalVolume} BT</Text>
					{market.expiresAt && market.status === 'open' && (
						<Badge colorScheme={marketExpired ? 'red' : 'yellow'} borderRadius='6px' px={2} py={1}>
							<HStack spacing={1}><Icon as={IoTimeOutline} boxSize={3} /><Text>{marketExpired ? 'EXPIRED' : expiryTimeLeft}</Text></HStack>
						</Badge>
					)}
					{market.challengeDeadline && !challengeExpired && market.status === 'resolved' && (
						<Badge colorScheme='orange' borderRadius='6px' px={2} py={1}>
							<HStack spacing={1}><Icon as={IoWarningOutline} boxSize={3} /><Text>Challenge: {challengeTimeLeft}</Text></HStack>
						</Badge>
					)}
				</HStack>

				{market.outcome && (
					<Badge colorScheme='green' mt={4} fontSize='md' px={4} py={2} borderRadius='lg'>
						OUTCOME: {market.outcome}
					</Badge>
				)}

				<VStack align='flex-start' spacing={3} mt={8}>
					{market.options.map((opt, i) => (
						<HStack key={opt} spacing={3}>
							<Box w='12px' h='12px' borderRadius='full' bg={palette[i % palette.length]} />
							<Text fontWeight='900' fontSize='xl' color='textPrimary'>
								<Text as='span' fontWeight='600' color='textSecondary' mr={4} w='100px' display='inline-block'>{opt}</Text>
								{Math.round(((market.pools[opt] || 0) / market.totalPot) * 100)}%
							</Text>
						</HStack>
					))}
				</VStack>
			</Box>

			{marketExpired && market.status === 'open' && isCreatorOrAdmin && (
				<Box mb={8} bg='noAction' p={4} borderRadius='16px' color='white'>
					<HStack><Icon as={IoWarningOutline} /><Text fontWeight='800'>This market has expired. New bets are blocked. Please resolve it now.</Text></HStack>
				</Box>
			)}

			<ProbabilityGraph market={market} bets={bets} />

			<Flex gap={8} direction={{ base: 'column', md: 'row' }}>
				<Box flex={1}>
					<Box bg='surface' p={6} borderRadius='18px' border='1px solid' borderColor='border' shadow='sm'>
						<Text fontSize='10px' color='textSecondary' fontWeight='800' mb={4} textTransform='uppercase'>Acquire Shares</Text>
						{marketExpired && market.status === 'open' ? (
							<Text color='textSecondary' fontSize='sm'>Betting is closed — market expired.</Text>
						) : (
							<BetSlip market={market} />
						)}
					</Box>
				</Box>
				<Box flex={1}>
					<Box bg='surfaceDeep' p={6} borderRadius='18px' border='1px solid' borderColor='border' mb={6}>
						<Text fontSize='10px' color='textSecondary' fontWeight='800' mb={4} textTransform='uppercase'>Your Holdings</Text>
						<VStack align='stretch' spacing={3}>
							{market.options.map(opt => (
								<Flex key={opt} justify='space-between' align='center'>
									<Text fontSize='sm' fontWeight='700'>{opt}</Text>
									<Text fontFamily='JetBrains Mono' fontWeight='800'>{myHoldings[opt] || 0} BT</Text>
								</Flex>
							))}
						</VStack>
					</Box>

					{/* Bettor Activity */}
					<Box bg='surfaceDeep' p={6} borderRadius='18px' border='1px solid' borderColor='border'>
						<Text fontSize='10px' color='textSecondary' fontWeight='800' mb={4} textTransform='uppercase'>Market Participants</Text>
						{(() => {
							const uniqueBettors = [...new Set(bets.filter(b => !b.isHouseSeed).map(b => b.userId))];
							if (uniqueBettors.length === 0) return <Text fontSize='sm' color='textSecondary'>No participants yet.</Text>;
							return (
								<VStack align='stretch' spacing={2}>
									{uniqueBettors.map((uid, i) => {
										const rm = roommates.find((r: any) => r.id === uid);
										const isMe = uid === user?.uid;
										const userBets = bets.filter(b => b.userId === uid && !b.isHouseSeed);
										const totalStake = userBets.reduce((a, b) => a + b.amount, 0);
										return (
											<Flex key={uid} justify='space-between' align='center'>
												<Text fontSize='sm' fontWeight='700' color={isMe ? 'primaryAction' : 'textPrimary'}>
													{isMe ? 'You' : (rm?.displayName?.split(' ')[0] || `Participant ${i + 1}`)}
												</Text>
												<Text fontFamily='JetBrains Mono' fontWeight='700' fontSize='sm' color='textSecondary'>{totalStake} BT</Text>
											</Flex>
										);
									})}
								</VStack>
							);
						})()}
					</Box>
				</Box>
			</Flex>

			{/* Creator: Direct Resolve */}
			{isCreatorOrAdmin && market.status === 'open' && (
				<Box mt={12} bg='surface' p={8} borderRadius='24px' border='1px solid' borderColor='yesAction' borderStyle='dashed'>
					<Text color='textPrimary' fontWeight='900' mb={2} fontSize='lg'>RESOLVE MARKET</Text>
					<Text color='textSecondary' fontSize='sm' mb={4}>Select the winning outcome. Payouts happen instantly. Other bettors have 24hrs to challenge.</Text>
					<HStack>
						<Select placeholder='Select Winning Outcome' value={settleOutcome} onChange={(e) => setSettleOutcome(e.target.value)} bg='bg'>
							{market.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
						</Select>
						<Button colorScheme='green' px={8} onClick={handleResolve} isDisabled={!settleOutcome}>RESOLVE</Button>
					</HStack>
				</Box>
			)}

			{/* Challenge Button */}
			{canChallenge && (
				<Box mt={8} bg='surface' p={6} borderRadius='24px' border='1px solid' borderColor='orange.400'>
					<Text color='textPrimary' fontWeight='900' mb={2}>DISPUTE THIS RESOLUTION</Text>
					<Text color='textSecondary' fontSize='sm' mb={4}>
						This market was resolved as "{market.outcome}". If you disagree, challenge it within {challengeTimeLeft}. An impartial reviewer will decide.
					</Text>
					<Button colorScheme='orange' onClick={handleChallenge} w='100%' h='50px' fontWeight='900'>
						CHALLENGE RESOLUTION
					</Button>
				</Box>
			)}

			{/* Dispute Reviewer */}
			{isDisputeReviewer && (
				<Box mt={8} bg='surface' p={8} borderRadius='24px' border='2px solid' borderColor='red.400'>
					<Text color='noAction' fontWeight='900' mb={2} fontSize='lg'>⚖️ YOU ARE THE JUDGE</Text>
					<Text color='textSecondary' fontSize='sm' mb={4}>
						This market's original resolution ("{market.outcome}") was challenged. Pick the correct outcome.
					</Text>
					<HStack>
						<Select placeholder='Select Correct Outcome' value={settleOutcome} onChange={(e) => setSettleOutcome(e.target.value)} bg='bg'>
							{market.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
						</Select>
						<Button colorScheme='red' px={8} onClick={handleDisputeResolve} isDisabled={!settleOutcome}>FINALIZE</Button>
					</HStack>
				</Box>
			)}
		</Box>
	);
};

export default MarketPage;
