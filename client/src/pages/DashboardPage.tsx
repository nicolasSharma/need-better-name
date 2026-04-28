import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack, HStack, Avatar, Icon, Button, useDisclosure, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Switch, Divider, Badge, useColorMode, RadioGroup, Radio, Stack, IconButton } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { IoCheckmarkCircleOutline, IoWarningOutline, IoNotificationsOutline, IoSettingsOutline, IoClose, IoMoonOutline, IoSunnyOutline, IoLaptopOutline, IoAddCircleOutline, IoLogOutOutline, IoWalletOutline, IoStatsChartOutline, IoArrowBack } from 'react-icons/io5';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';

import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { useMarkets } from '@/hooks/useMarkets';
import { useChores } from '@/hooks/useChores';
import { useSplitwise } from '@/hooks/useSplitwise';
import { useInbox } from '@/hooks/useInbox';
import { updateNotificationPrefs } from '@/lib/firestore';

import MarketCard from '@/components/MarketCard';
import AnimatedNumber from '@/components/AnimatedNumber';
import Skeleton from '@/components/Skeleton';
import { triggerAudioPop } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';


const DashboardPage = () => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { profile, loading: profileLoading } = useUser();
	const { markets, loading: marketsLoading } = useMarkets();
	const { chores, loading: choresLoading } = useChores();
	const { optimizedRoutes, loading: splitwiseLoading } = useSplitwise();
	const { events } = useInbox();
	const { colorMode, setColorMode } = useColorMode();


	// Modal States
	const { isOpen: isInboxOpen, onOpen: openInbox, onClose: closeInbox } = useDisclosure();
	const { isOpen: isSettingsOpen, onOpen: openSettings, onClose: closeSettings } = useDisclosure();

	const [hasUnread, setHasUnread] = useState(false);
	const [pushEnabled, setPushEnabled] = useState(false);

	// Toggles
	const [prefs, setPrefs] = useState({ bounties: true, chores: true, markets: true, usd: true });

	useEffect(() => {
		if (profile?.notificationPrefs) {
			setPrefs(profile.notificationPrefs);
		}
	}, [profile]);

	useEffect(() => {
		if (events.length > 0) setHasUnread(true);
		
		// Attempt HTML5 Push notification integration if enabled and unread
		if (pushEnabled && events.length > 0 && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
			const latest = events[0];
			new window.Notification('The Hub', { body: latest.title, icon: '/favicon.ico' });
		}
	}, [events]);

	const requestWebPush = async () => {
		if (!('Notification' in window)) return alert('Push is unsupported in this browser. On iOS, you must Add to Home Screen first.');
		try {
			const permission = await Notification.requestPermission();
			if (permission === 'granted') setPushEnabled(true);
		} catch(e) {
			console.log(e);
		}
	};

	const savePrefs = async (newPrefs: any) => {
		if (!user) return;
		setPrefs(newPrefs);
		await updateNotificationPrefs(user.uid, newPrefs);
	};

	const activeMarkets = markets.filter((m) => m.status === 'open');
	
	const myChores = chores.filter((c) => {
		if (c.status === 'completed') return false;
		if (c.status === 'claimed' && c.assigneeId === user?.uid) return true;
		if (c.status === 'open' && (c.assignedTo === 'all' || (Array.isArray(c.assignedTo) && c.assignedTo.includes(user?.uid || '')))) return true;
		return false;
	});
	
	const myDebts = optimizedRoutes.filter(r => r.fromId === user?.uid);

	const isLoading = profileLoading || marketsLoading || choresLoading || splitwiseLoading;


	return (
		<Box p={8} pb={24} maxW='800px'>
			<TutorialWizard 
				isSetup 
				pageKey="setup" 
				steps={[
					{
						title: "Install The Hub",
						body: "Tap the Share icon in your browser and select 'Add to Home Screen' for the full execution experience.",
						icon: IoAddCircleOutline
					},
					{
						title: "500 BT Initial Grant",
						body: "You've been credited with a starting balance of 500 BT. Use it to place bets, buy perks, or seed new markets.",
						icon: IoWalletOutline
					},
					{
						title: "Live Market Ticker",
						body: "Watch the top of your screen for a real-time feed of every trade, payout, and reward across the entire house.",
						icon: IoStatsChartOutline
					},
					{
						title: "Stay Synced",
						body: "Enable house notifications to catch market shifts and chore alerts in real-time.",
						icon: IoNotificationsOutline,
						actionLabel: "Enable Notifications"
					}
				]} 
			/>

			<TutorialWizard 
				pageKey="dashboard" 
				steps={[
					{
						title: "The HUB Core",
						body: "This is your primary command center. Monitor your BT balance and urgent Action Items here.",
						icon: IoLaptopOutline
					},
					{
						title: "Urgent Payouts",
						body: "Keep an eye on the 'Action Items' list. This is where pending debts and assigned chores appear.",
						icon: IoWarningOutline
					},
					{
						title: "Global Command",
						body: "Tap the floating (+) button in the bottom right to quickly add expenses, chores, or create new casino markets from anywhere.",
						icon: IoAddCircleOutline
					},
					{
						title: "Final Step: Native App",
						body: "To get full notifications and the best experience, you MUST add this to your home screen. It will feel like a real app!",
						icon: IoLaptopOutline
					},
					{
						title: "How to Install",
						body: "Tap the 'Share' icon in your browser (bottom center) and select 'Add to Home Screen'.",
						icon: IoAddCircleOutline,
						specialType: 'ios_share'
					}
				]} 
			/>

			<Flex justify='space-between' align='center' mb={8}>
				<Box>
					{isLoading ? (
						<Skeleton w='200px' h='32px' mb={2} />
					) : (
						<Heading size='lg' color='textPrimary' mb={1} fontWeight='700'>
							Welcome, {profile?.displayName || 'Trader'}
						</Heading>
					)}
					<Text color='textSecondary'>The Hub Overview</Text>
				</Box>

				<HStack spacing={3}>
					<Box position='relative' cursor='pointer' onClick={() => { setHasUnread(false); openInbox(); }}>
						<Icon as={IoNotificationsOutline} boxSize={6} color='textPrimary' />
						{hasUnread && <Box position='absolute' top={0} right={0} w='10px' h='10px' bg='red.500' borderRadius='full' border='2px solid' borderColor='bg' />}
					</Box>
					<Icon as={IoSettingsOutline} boxSize={6} color='textPrimary' cursor='pointer' onClick={openSettings} />
				</HStack>
			</Flex>

			{/* Main Widgets (Liquidity, Action Items, Contracts) */}
			<Box bg='surface' p={6} borderRadius='16px' border='1px solid' borderColor='border' mb={8}>
				<Text fontSize='sm' color='textSecondary' fontWeight='600' mb={2}>LIQUIDITY BALANCE</Text>
				{isLoading ? <Skeleton w='100px' h='48px' /> : (
					<Text fontSize='5xl' fontWeight='800' color='primaryAction' fontFamily='JetBrains Mono' lineHeight='1'>
						<AnimatedNumber value={profile?.balance || 0} /> <Text as='span' fontSize='xl' color='textSecondary'>BT</Text>
					</Text>
				)}

			</Box>

			{(myChores.length > 0 || myDebts.length > 0) && (
				<Box mb={8}>
					<Heading size='md' color='textPrimary' mb={4} fontWeight='700'>Action Items</Heading>
					<VStack spacing={3} align='stretch'>
						{myDebts.map((debt, idx) => (
							<Flex key={`debt-${idx}`} bg='surfaceDeep' p={4} borderRadius='12px' border='1px solid' borderColor='noAction' justify='space-between' align='center' onClick={() => navigate('/splitwise')} cursor='pointer'>
								<HStack spacing={3}>
									<Icon as={IoWarningOutline} color='noAction' boxSize={5} />
									<Box>
										<Text fontSize='sm' fontWeight='700' color='textPrimary'>Settle Up</Text>
										<Text fontSize='xs' color='textSecondary'>You have an open balance to pay</Text>
									</Box>
								</HStack>
								<Text fontFamily='JetBrains Mono' fontWeight='700' color='noAction'>-${debt.amount.toFixed(2)}</Text>
							</Flex>
						))}

						{myChores.map((chore) => (
							<Flex key={chore.id} bg='surfaceDeep' p={4} borderRadius='12px' border='1px solid' borderColor='primaryAction' justify='space-between' align='center'>
								<HStack spacing={3}>
									<Icon as={IoCheckmarkCircleOutline} color='primaryAction' boxSize={5} />
									<Box>
										<Text fontSize='sm' fontWeight='700' color='textPrimary'>{chore.name}</Text>
										<Text fontSize='xs' color='textSecondary'>Reward: {chore.reward} BT</Text>
									</Box>
								</HStack>
								<Button size='sm' variant='surface' color='primaryAction' onClick={() => navigate('/chores')}>View</Button>
							</Flex>
						))}
					</VStack>
				</Box>
			)}

			<Heading size='md' color='textPrimary' mb={4} fontWeight='700'>Live Contracts</Heading>
			{isLoading ? (
				<VStack spacing={4}><Skeleton h='250px' borderRadius='16px' /><Skeleton h='250px' borderRadius='16px' /></VStack>
			) : activeMarkets.length === 0 ? (
				<Box bg='surface' p={6} borderRadius='16px' border='1px solid' borderColor='border' textAlign='center'>
					<Text color='textSecondary'>No contracts trading right now.</Text>
				</Box>
			) : (
				<VStack spacing={4} align='stretch'>{activeMarkets.map((m) => <MarketCard key={m.id} market={m} />)}</VStack>
			)}

			{/* Inbox Drawer */}
			<Drawer isOpen={isInboxOpen} placement="right" onClose={closeInbox} size="md">
				<DrawerOverlay backdropFilter='blur(4px)' />
				<DrawerContent bg='bg' borderLeft='1px solid' borderColor='border'>
					<DrawerHeader borderBottomWidth="1px" borderColor='border' color='textPrimary' pt='calc(20px + env(safe-area-inset-top, 0px))'>
						<Flex align='center' justify='space-between'>
							<HStack spacing={2} cursor='pointer' onClick={closeInbox}>
								<Icon as={IoArrowBack} />
								<Text fontSize='lg' fontWeight='900'>Inbox Activity</Text>
							</HStack>
							<IconButton icon={<IoClose />} variant='ghost' size='sm' onClick={closeInbox} aria-label="Close" />
						</Flex>
					</DrawerHeader>
					<DrawerBody p={0}>
						{events.length === 0 ? (
							<Text color='textSecondary' p={6} textAlign='center'>No recent activity matching your preferences.</Text>
						) : (
							<VStack spacing={0} align='stretch'>
								{events.map((ev) => (
									<Box key={ev.id} p={4} borderBottom='1px solid' borderColor='border' _hover={{ bg: 'surface' }}>
										<HStack justify='space-between' mb={1}>
											<Text fontSize='10px' color='primaryAction' fontWeight='700' textTransform='uppercase'>{ev.category}</Text>
											{ev.createdAt && <Text fontSize='10px' color='textSecondary'>{ev.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>}
										</HStack>
										<Text fontSize='sm' fontWeight='700' color='textPrimary' mb={1}>{ev.title}</Text>
										<Text fontSize='13px' color='textSecondary'>{ev.body}</Text>
									</Box>
								))}
							</VStack>
						)}
					</DrawerBody>
				</DrawerContent>
			</Drawer>

			{/* Settings Modal */}
			<Modal isOpen={isSettingsOpen} onClose={closeSettings} isCentered>
				<ModalOverlay backdropFilter='blur(4px)' />
				<ModalContent bg='surface' border='1px solid' borderColor='border' borderRadius='16px' m={4}>
					<ModalHeader color='textPrimary'>Communication Settings</ModalHeader>
					<ModalCloseButton color='textSecondary' />
					<ModalBody pb={8}>
						<VStack spacing={6} align='stretch'>
							<Box>
								<Text fontSize='11px' color='textSecondary' fontWeight='700' textTransform='uppercase' mb={3} letterSpacing='widest'>Interface Engine</Text>
								<RadioGroup onChange={setColorMode} value={colorMode} bg='surfaceDeep' p={4} borderRadius='12px' border='1px solid' borderColor='border'>
									<Stack spacing={4}>
										<Radio value='light' colorScheme='blue'>
											<HStack spacing={3}>
												<Icon as={IoSunnyOutline} />
												<Box>
													<Text fontSize='sm' fontWeight='600'>Clean Light</Text>
													<Text fontSize='xs' color='textSecondary'>High-contrast day mode</Text>
												</Box>
											</HStack>
										</Radio>
										<Radio value='dark' colorScheme='blue'>
											<HStack spacing={3}>
												<Icon as={IoMoonOutline} />
												<Box>
													<Text fontSize='sm' fontWeight='600'>Fintech Dark</Text>
													<Text fontSize='xs' color='textSecondary'>Deep-space execution mode</Text>
												</Box>
											</HStack>
										</Radio>
									</Stack>
								</RadioGroup>
							</Box>

							<Box>
								<Text fontSize='11px' color='textSecondary' fontWeight='700' textTransform='uppercase' mb={3} letterSpacing='widest'>Push Linkage</Text>
								<Flex justify='space-between' align='center' bg='surfaceDeep' p={3} borderRadius='8px'>
									<Box>
										<Text fontSize='sm' color='textPrimary' fontWeight='600'>Native Web Push</Text>
										<Text fontSize='xs' color='textSecondary'>Receive alerts outside the app</Text>
									</Box>
									<Button size='sm' variant='outline' colorScheme='green' onClick={requestWebPush} isDisabled={pushEnabled}>
										{pushEnabled ? 'Active' : 'Enable'}
									</Button>
								</Flex>
							</Box>

							<Box>
								<Text fontSize='11px' color='textSecondary' fontWeight='700' textTransform='uppercase' mb={3} letterSpacing='widest'>Routing Engine</Text>
								
								<VStack spacing={0} bg='surfaceDeep' borderRadius='8px' border='1px solid' borderColor='border' divider={<Divider borderColor='border' />}>
									<Flex w='100%' justify='space-between' align='center' p={3}>
										<Text fontSize='sm' color='textPrimary'>P2P Bounties</Text>
										<Switch isChecked={prefs.bounties} onChange={(e) => savePrefs({ ...prefs, bounties: e.target.checked })} colorScheme='yellow' />
									</Flex>
									<Flex w='100%' justify='space-between' align='center' p={3}>
										<Text fontSize='sm' color='textPrimary'>House Chores Validations</Text>
										<Switch isChecked={prefs.chores} onChange={(e) => savePrefs({ ...prefs, chores: e.target.checked })} colorScheme='yellow' />
									</Flex>
									<Flex w='100%' justify='space-between' align='center' p={3}>
										<Text fontSize='sm' color='textPrimary'>Casino Market Updates</Text>
										<Switch isChecked={prefs.markets} onChange={(e) => savePrefs({ ...prefs, markets: e.target.checked })} colorScheme='yellow' />
									</Flex>
									<Flex w='100%' justify='space-between' align='center' p={3}>
										<Box>
											<Text fontSize='sm' color='textPrimary'>Splitwise USD Settlements</Text>
											<Text fontSize='10px' color='noAction'>Urgent Debts always bypass filters</Text>
										</Box>
										<Switch isChecked={prefs.usd} onChange={(e) => savePrefs({ ...prefs, usd: e.target.checked })} colorScheme='yellow' />
									</Flex>
								</VStack>
							</Box>

							<Box pt={2}>
								<Button
									w='100%'
									variant='outline'
									colorScheme='red'
									leftIcon={<Icon as={IoLogOutOutline} />}
									onClick={() => { signOut(auth); closeSettings(); navigate('/login'); }}
								>
									Sign Out
								</Button>
							</Box>
						</VStack>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Box>
	);
};

export default DashboardPage;
