import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Flex, Heading, Text, VStack, HStack, Avatar, Icon, Button, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Switch, Divider, Badge, useColorMode, IconButton } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { 
	IoCheckmarkCircleOutline, IoWarningOutline, IoNotificationsOutline, 
	IoSettingsOutline, IoClose, IoMoonOutline, IoSunnyOutline, 
	IoLaptopOutline, IoLogOutOutline, 
	IoNotificationsCircleOutline, IoColorPaletteOutline, IoPersonCircleOutline,
	IoShieldHalf, IoList, IoChevronForward
} from 'react-icons/io5';
import PullToRefresh from '@/components/PullToRefresh';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { useAuth } from '@/context/AuthProvider';
import { useUser, useMarkets, useChores, useInbox } from '@/context/AppDataProvider';
import { useSplitwise } from '@/hooks/useSplitwise';
import { updateNotificationPrefs } from '@/lib/services';
import { isSystemAdmin } from '@/lib/admin';
import MarketCard from '@/components/MarketCard';
import AnimatedNumber from '@/components/AnimatedNumber';
import Skeleton from '@/components/Skeleton';
import { triggerAudioPop } from '@/lib/haptics';
import TutorialWizard from '@/components/TutorialWizard';
import InstallPrompt from '@/components/InstallPrompt';
import { requestNotificationPermission } from '@/lib/notifications';

const DashboardPage = () => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { profile, loading: profileLoading } = useUser();
	const { markets, loading: marketsLoading } = useMarkets();
	const { chores, loading: choresLoading } = useChores();
	const { optimizedRoutes, loading: splitwiseLoading } = useSplitwise();
	const { events } = useInbox();
	const { colorMode, setColorMode } = useColorMode();
	const toast = useToast();


	// Modal States
	const { isOpen: isInboxOpen, onOpen: openInbox, onClose: closeInbox } = useDisclosure();
	const { isOpen: isSettingsOpen, onOpen: openSettings, onClose: closeSettings } = useDisclosure();

	const [hasUnread, setHasUnread] = useState(false);
	const [pushEnabled, setPushEnabled] = useState(false);

	// Toggles
	const [prefs, setPrefs] = useState({ 
		bounties: true, chores: true, markets: true, usd: true,
		haptics: true, sounds: true 
	});

	const pageLoadTime = useRef(Date.now());

	useEffect(() => {
		if (profile?.notificationPrefs) {
			setPrefs(profile.notificationPrefs);
		}
		if (isSystemAdmin(profile?.displayName)) {
			navigate('/admin');
		}
	}, [profile, navigate]);

	useEffect(() => {
		if (events.length > 0) setHasUnread(true);
		
		if (pushEnabled && events.length > 0 && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
			const latest = events[0];
			const eventTime = latest.createdAt?.toMillis ? latest.createdAt.toMillis() : (latest.createdAt?.seconds ? latest.createdAt.seconds * 1000 : Date.now());
			if (eventTime > pageLoadTime.current) {
				new window.Notification('The Hub', { body: latest.title, icon: '/favicon.ico' });
			}
		}
	}, [events, pushEnabled]);

	const requestWebPush = async () => {
		if (!user) return;
		const success = await requestNotificationPermission(user.uid);
		if (success) {
			setPushEnabled(true);
			toast({ title: 'Push Notifications Enabled', status: 'success', duration: 3000 });
		} else {
			toast({ title: 'Registration Failed', description: 'Could not register push notifications in this browser.', status: 'error', duration: 3000 });
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

	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 17) return 'Good afternoon';
		return 'Good evening';
	};

	const pendingChoreCount = chores.filter(c => c.status === 'pending_review' && c.reviewerId === user?.uid).length;
	const pendingMarketCount = markets.filter(m => m.status === 'pending_resolution' && m.reviewerId === user?.uid).length;
	const totalPending = pendingChoreCount + pendingMarketCount;

	const handleRefresh = useCallback(async () => {
		// Data is live via Firestore listeners — this is visual confirmation
		await new Promise(r => setTimeout(r, 400));
	}, []);

	return (
		<PullToRefresh onRefresh={handleRefresh}>
		<Box p={6}>
			{/* Dashboard Content */}
			<VStack spacing={6} align='stretch'>
				<Flex justify='space-between' align='center'>
					<VStack align='start' spacing={0} cursor='pointer' onClick={() => navigate('/profile')} _active={{ opacity: 0.7 }} transition='opacity 0.15s'>
						<Text fontSize='xs' fontWeight='800' color='textSecondary' mb={-1}>{getGreeting()},</Text>
						<Heading size='lg' color='textPrimary' letterSpacing='tighter' lineHeight='1'>
							{profile?.displayName?.split(' ')[0] || 'Resident'}
						</Heading>
					</VStack>
					<HStack spacing={1} bg='surface' p={1} borderRadius='full' border='1px solid' borderColor='border' boxShadow='sm'>
						<IconButton
							icon={<Icon as={IoNotificationsOutline} boxSize={4} />}
							variant='ghost'
							borderRadius='full'
							onClick={openInbox}
							aria-label="Notifications"
							size='sm'
						/>

						<IconButton
							icon={<Icon as={IoSettingsOutline} boxSize={4} />}
							variant='ghost'
							borderRadius='full'
							onClick={openSettings}
							aria-label="Settings"
							size='sm'
						/>
					</HStack>
				</Flex>

				{/* Quick Stats */}
				{profileLoading ? (
					<Skeleton h='90px' borderRadius='24px' />
				) : (
					<Box>
						<Box bg='surface' p={5} borderRadius='24px' border='1px solid' borderColor='border' boxShadow='lg'>
							<Text fontSize='9px' fontWeight='900' color='textSecondary' mb={2} letterSpacing='widest'>CURRENT BALANCE</Text>
							<Flex align='baseline'>
								<Text fontSize='3xl' fontWeight='900' color='primaryAction' lineHeight='0.8'>
									<AnimatedNumber value={profile?.balance || 0} />
								</Text>
								<Text fontSize='xs' fontWeight='900' color='primaryAction' ml={2} opacity={0.8}>BT</Text>
							</Flex>
						</Box>
					</Box>
				)}

				{/* House Polls Access */}
				<Box bg='surface' p={4} borderRadius='16px' border='1px solid' borderColor='border' cursor='pointer' onClick={() => navigate('/polls')} _active={{ transform: 'scale(0.98)' }} transition='all 0.15s'>
					<HStack justify="space-between">
						<HStack spacing={3}>
							<Flex w='40px' h='40px' borderRadius='12px' bg='rgba(56, 178, 172, 0.15)' align='center' justify='center'>
								<Icon as={IoList} color='teal.400' boxSize={5} />
							</Flex>
							<Box>
								<Text fontWeight='800' fontSize='sm' color='textPrimary'>House Polls</Text>
								<Text fontSize='xs' color='textSecondary'>Vote on house decisions</Text>
							</Box>
						</HStack>
						<Icon as={IoChevronForward} color='textSecondary' />
					</HStack>
				</Box>

				{/* Pending Actions */}
				<AnimatePresence>
					{totalPending > 0 && (
						<Box
							as={motion.div}
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={{ opacity: 0, height: 0 }}
							bg='surface'
							p={4}
							borderRadius='16px'
							border='1px solid'
							borderColor='orange.400'
							cursor='pointer'
							onClick={() => navigate('/leaderboard')}
							_active={{ transform: 'scale(0.98)' }}
							transition='all 0.15s'
						>
							<HStack spacing={3}>
								<Flex w='40px' h='40px' borderRadius='12px' bg='rgba(255,149,0,0.15)' align='center' justify='center'>
									<Icon as={IoShieldHalf} color='orange.400' boxSize={5} />
								</Flex>
								<Box flex={1}>
									<Text fontWeight='800' fontSize='sm' color='textPrimary'>Awaiting Your Judgement</Text>
									<Text fontSize='xs' color='textSecondary'>
										{pendingChoreCount > 0 && `${pendingChoreCount} chore${pendingChoreCount > 1 ? 's' : ''}`}
										{pendingChoreCount > 0 && pendingMarketCount > 0 && ' · '}
										{pendingMarketCount > 0 && `${pendingMarketCount} market${pendingMarketCount > 1 ? 's' : ''}`}
										{' to review'}
									</Text>
								</Box>
								<Badge colorScheme='orange' borderRadius='full' fontSize='sm' px={3}>{totalPending}</Badge>
							</HStack>
						</Box>
					)}
				</AnimatePresence>

				{/* Markets */}
				<Box>
					<Flex justify='space-between' align='center' mb={4}>
						<Text fontSize='xs' fontWeight='900' color='textSecondary' letterSpacing='widest'>LIVE MARKETS</Text>
						<Button size='xs' variant='link' color='primaryAction' onClick={() => navigate('/casino')}>VIEW ALL</Button>
					</Flex>
					<VStack spacing={4} align='stretch'>
						{marketsLoading ? (
							<>
								<Skeleton h='140px' borderRadius='16px' />
								<Skeleton h='140px' borderRadius='16px' />
							</>
						) : activeMarkets.slice(0, 3).map(market => (
							<MarketCard key={market.id} market={market} />
						))}
					</VStack>
				</Box>
			</VStack>

			{/* Settings Modal */}
			<Modal isOpen={isSettingsOpen} onClose={closeSettings} size='full'>
				<ModalOverlay />
				<ModalContent bg='bg' m={0} borderRadius={0}>
					<ModalHeader borderBottom='1px solid' borderColor='border' pt='env(safe-area-inset-top, 24px)'>
						<Flex justify='space-between' align='center'>
							<Text fontSize='sm' fontWeight='900'>SETTINGS</Text>
							<IconButton icon={<IoClose />} variant='ghost' onClick={closeSettings} aria-label="Close" />
						</Flex>
					</ModalHeader>
					<ModalBody p={0}>
						<Tabs isFitted variant='unstyled'>
							<TabList bg='surface' borderBottom='1px solid' borderColor='border'>
								<Tab _selected={{ color: 'primaryAction', borderBottom: '2px solid', borderColor: 'primaryAction' }} fontWeight='800' fontSize='xs'>NOTIFICATIONS</Tab>
								<Tab _selected={{ color: 'primaryAction', borderBottom: '2px solid', borderColor: 'primaryAction' }} fontWeight='800' fontSize='xs'>ACCOUNT</Tab>
							</TabList>
							<TabPanels>
								<TabPanel p={6}>
									<VStack spacing={4} align='stretch'>
										<Button w='100%' h='56px' borderRadius='16px' variant='surface' onClick={requestWebPush} color='textPrimary'>
											ENABLE PUSH NOTIFICATIONS
										</Button>
										<Box>
											<Text fontSize='11px' color='textSecondary' fontWeight='800' textTransform='uppercase' mb={3} letterSpacing='widest'>Alert Types</Text>
											<VStack bg='surfaceDeep' borderRadius='16px' border='1px solid' borderColor='border' divider={<Divider borderColor='border' />}>
												<Flex w='100%' justify='space-between' align='center' p={4}>
													<Box>
														<Text fontSize='sm' color='textPrimary' fontWeight='700'>Market Updates</Text>
														<Text fontSize='xs' color='textSecondary'>Outcome and leaderboard alerts</Text>
													</Box>
													<Switch isChecked={prefs.markets} onChange={(e) => savePrefs({ ...prefs, markets: e.target.checked })} colorScheme='blue' />
												</Flex>
												<Flex w='100%' justify='space-between' align='center' p={4}>
													<Box>
														<Text fontSize='sm' color='textPrimary' fontWeight='700'>USD Settlements</Text>
														<Text fontSize='xs' color='noAction'>Urgent debts always bypass filters</Text>
													</Box>
													<Switch isChecked={prefs.usd} onChange={(e) => savePrefs({ ...prefs, usd: e.target.checked })} colorScheme='blue' />
												</Flex>
											</VStack>
										</Box>
									</VStack>
								</TabPanel>
								<TabPanel p={6}>
									<VStack spacing={6} align='stretch'>
										<Box bg='surfaceDeep' p={4} borderRadius='16px' border='1px solid' borderColor='border'>
											<HStack spacing={4}>
												<Avatar size='md' src={user?.photoURL || ''} name={profile?.displayName || ''} />
												<VStack align='start' spacing={0}>
													<Text fontWeight='800' color='textPrimary'>{profile?.displayName}</Text>
													<Text fontSize='xs' color='textSecondary'>{user?.email}</Text>
												</VStack>
											</HStack>
										</Box>

										<Box>
											<Text fontSize='11px' color='textSecondary' fontWeight='800' textTransform='uppercase' mb={3} letterSpacing='widest'>Account Actions</Text>
											<VStack spacing={4}>
												<Button
													w='100%'
													h='56px'
													variant='outline'
													colorScheme='red'
													leftIcon={<Icon as={IoLogOutOutline} />}
													onClick={() => { signOut(auth); closeSettings(); navigate('/login'); }}
													borderRadius='16px'
													fontWeight='800'
												>
													Log Out of The Hub
												</Button>
												
												<Box w='100%' pt={4}>
													<Text fontSize='10px' color='red.500' fontWeight='900' mb={2} letterSpacing='widest'>DANGER ZONE</Text>
													<Button
														w='100%'
														variant='ghost'
														colorScheme='red'
														size='sm'
														onClick={() => {
															localStorage.clear();
															signOut(auth);
															window.location.href = '/login';
														}}
														fontWeight='800'
													>
														NUKE ALL SESSIONS & CACHE
													</Button>
												</Box>
											</VStack>
											<Text mt={8} textAlign='center' fontSize='10px' color='textSecondary' fontWeight='700' letterSpacing='widest'>
												THE HUB v1.5.0 • SYSTEM ACTIVE
											</Text>
											<Text mt={4} textAlign='center' fontSize='10px' color='textSecondary' fontWeight='700' letterSpacing='widest'>APPEARANCE</Text>
											<HStack spacing={2} bg='surfaceDeep' borderRadius='16px' border='1px solid' borderColor='border' p={2} mt={2}>
												{([['light','☀️ Light'],['dark','🌙 Dark'],['system','💻 System']] as const).map(([mode, label]) => (
													<Button key={mode} flex={1} h='44px' variant='unstyled' bg={colorMode === mode ? 'surface' : 'transparent'} color={colorMode === mode ? 'textPrimary' : 'textSecondary'} borderRadius='12px' fontWeight='800' fontSize='sm' shadow={colorMode === mode ? 'sm' : 'none'} onClick={() => setColorMode(mode)}>{label}</Button>
												))}
											</HStack>
										</Box>
									</VStack>
								</TabPanel>
							</TabPanels>
						</Tabs>
					</ModalBody>
				</ModalContent>
			</Modal>
		</Box>
		</PullToRefresh>
	);
};

export default DashboardPage;
