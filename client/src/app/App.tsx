import { lazy, Suspense, useEffect } from 'react';
import { ChakraProvider, Box, VStack, useToast } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from '@/context/AuthProvider';
import { AppDataProvider } from '@/context/AppDataProvider';
import theme from '@/config/theme';
import { onMessage } from 'firebase/messaging';
import { messaging } from '@/config/firebase';

import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';

// Lazy-loaded routes — only downloaded when navigated to
const LedgerPage = lazy(() => import('@/pages/LedgerPage'));
const SplitwisePage = lazy(() => import('@/pages/SplitwisePage'));
const ChoresPage = lazy(() => import('@/pages/ChoresPage'));
const CasinoPage = lazy(() => import('@/pages/CasinoPage'));
const GamesPage = lazy(() => import('@/pages/GamesPage'));
const MarketPage = lazy(() => import('@/pages/MarketPage'));
const PerksPage = lazy(() => import('@/pages/PerksPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const PollsPage = lazy(() => import('@/pages/PollsPage'));

import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import BottomNav from '@/components/BottomNav';
import TopNav from '@/components/TopNav';
import { GlobalActionMenu } from '@/components/GlobalActionMenu';
import Skeleton from '@/components/Skeleton';
import OfflineBanner from '@/components/OfflineBanner';
import CoinDrop from '@/components/CoinDrop';
import ToastOverlay from '@/components/ToastOverlay';
import ForceNotifModal from '@/components/ForceNotifModal';

import { useAuth } from '@/context/AuthProvider';

const SOUNDS: Record<string, string> = {
	airhorn: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav',
	sad_trombone: 'https://assets.mixkit.co/active_storage/sfx/1018/1018-84.wav',
	alarm: 'https://assets.mixkit.co/active_storage/sfx/2190/2190-84.wav',
	cheers: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-84.wav',
	boo: 'https://assets.mixkit.co/active_storage/sfx/2288/2288-84.wav'
};

const PageFallback = () => (
	<VStack spacing={4} p={8} pt={20}>
		<Skeleton h='80px' borderRadius='24px' />
		<Skeleton h='200px' borderRadius='16px' />
		<Skeleton h='140px' borderRadius='16px' />
	</VStack>
);

const LazyRoute = ({ children }: { children: React.ReactNode }) => (
	<ProtectedRoute>
		<Suspense fallback={<PageFallback />}>
			{children}
		</Suspense>
	</ProtectedRoute>
);

const AppContent = () => {
	const location = useLocation();
	const isAuthPage = ['/login', '/signup'].includes(location.pathname);
	const showNavs = !isAuthPage;
	const toast = useToast();
	const { user } = useAuth();

	// Active Presence Heartbeat
	useEffect(() => {
		if (!user) return;
		
		const updatePresence = async () => {
			try {
				const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
				const { db } = await import('@/config/firebase');
				await updateDoc(doc(db, 'users', user.uid), {
					lastActiveAt: serverTimestamp()
				});
			} catch (e) {
				console.error('Error updating presence:', e);
			}
		};

		updatePresence();
		const interval = setInterval(updatePresence, 30000);
		return () => clearInterval(interval);
	}, [user]);

	// Listen to real-time taunts
	useEffect(() => {
		if (!user) return;

		let unsub: (() => void) | undefined;

		const setupTauntListener = async () => {
			try {
				const { collection, query, where, onSnapshot } = await import('firebase/firestore');
				const { db } = await import('@/config/firebase');
				const { markTauntPlayed } = await import('@/lib/services/taunts');

				const q = query(
					collection(db, 'taunts'),
					where('targetId', '==', user.uid),
					where('played', '==', false)
				);

				unsub = onSnapshot(q, (snap) => {
					snap.docs.forEach((d) => {
						const taunt = d.data();
						const soundUrl = SOUNDS[taunt.soundId];
						if (soundUrl) {
							const audio = new Audio(soundUrl);
							audio.play().catch(e => console.error('Audio play blocked:', e));
						}
						markTauntPlayed(d.id);
					});
				});
			} catch (e) {
				console.error('Error setting up taunt listener:', e);
			}
		};

		setupTauntListener();

		return () => {
			if (unsub) unsub();
		};
	}, [user]);

	useEffect(() => {
		try {
			const m = messaging();
			if (m) {
				const unsub = onMessage(m, (payload) => {
					console.log('Received foreground message: ', payload);
					toast({
						title: payload.notification?.title || 'Notification',
						description: payload.notification?.body || '',
						status: 'info',
						duration: 5000,
						isClosable: true,
						position: 'top',
					});
				});
				return unsub;
			}
		} catch (e) {
			console.log('Messaging not supported in this browser.', e);
		}
	}, [toast]);

	return (
		<Box bg="bg" minH="100%" color="textPrimary">
			<OfflineBanner />
			<CoinDrop />
			<ToastOverlay />
			<ForceNotifModal />
			{showNavs && <TopNav />}
			<Box 
				as="main" 
				maxW="container.xl" 
				mx="auto" 
				pt={showNavs ? 'calc(48px + env(safe-area-inset-top, 0px) + 24px)' : 0}
				pb={showNavs ? 'calc(env(safe-area-inset-bottom, 0px) + 80px)' : 0}
			>
				<AnimatePresence mode='wait'>
					<motion.div
						key={location.pathname}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.15, ease: 'easeInOut' }}
					>
				<Routes location={location}>
					<Route path='/login' element={<LoginPage />} />
					<Route path='/signup' element={<SignupPage />} />
					<Route path='/' element={<ProtectedRoute><ErrorBoundary><DashboardPage /></ErrorBoundary></ProtectedRoute>} />
					<Route path='/leaderboard' element={<LazyRoute><LedgerPage /></LazyRoute>} />
					<Route path='/splitwise' element={<LazyRoute><SplitwisePage /></LazyRoute>} />
					<Route path='/chores' element={<LazyRoute><ChoresPage /></LazyRoute>} />
					<Route path='/casino' element={<LazyRoute><CasinoPage /></LazyRoute>} />
					<Route path='/casino/games' element={<LazyRoute><GamesPage /></LazyRoute>} />
					<Route path='/casino/:id' element={<LazyRoute><MarketPage /></LazyRoute>} />
					<Route path='/perks' element={<LazyRoute><PerksPage /></LazyRoute>} />
					<Route path='/polls' element={<LazyRoute><PollsPage /></LazyRoute>} />
					<Route path='/profile/:userId?' element={<LazyRoute><ProfilePage /></LazyRoute>} />
					<Route path='/admin' element={<LazyRoute><AdminPage /></LazyRoute>} />
				</Routes>
					</motion.div>
				</AnimatePresence>
			</Box>
			{showNavs && <GlobalActionMenu />}
			{showNavs && <BottomNav />}
		</Box>
	);
};

const App = () => (
	<ChakraProvider theme={theme}>
		<ErrorBoundary fallbackTitle="Application Error">
			<AuthProvider>
				<AppDataProvider>
					<BrowserRouter>
						<AppContent />
					</BrowserRouter>
				</AppDataProvider>
			</AuthProvider>
		</ErrorBoundary>
	</ChakraProvider>
);

export default App;
