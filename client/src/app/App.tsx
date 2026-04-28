import { ChakraProvider, Box } from '@chakra-ui/react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import theme from '@/config/theme';

import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import ChoresPage from '@/pages/ChoresPage';
import CasinoPage from '@/pages/CasinoPage';
import MarketPage from '@/pages/MarketPage';
import PerksPage from '@/pages/PerksPage';
import LedgerPage from '@/pages/LedgerPage';
import AdminPage from '@/pages/AdminPage';
import SplitwisePage from '@/pages/SplitwisePage';
import ProtectedRoute from '@/components/ProtectedRoute';
import BottomNav from '@/components/BottomNav';
import TopNav from '@/components/TopNav';
import { GlobalActionMenu } from '@/components/GlobalActionMenu';
import { useEffect } from 'react';
import { useToast } from '@chakra-ui/react';

const AppLayout = () => {
	const toast = useToast();

	useEffect(() => {
		const checkVersion = async () => {
			try {
				const res = await fetch('/version.json?t=' + Date.now());
				const data = await res.json();
				const localVersion = localStorage.getItem('appVersion');
				
				if (localVersion && localVersion !== data.version) {
					toast({
						title: 'New Update Available',
						description: 'A new version of The Hub is ready. Refresh to see the latest features.',
						status: 'info',
						duration: null,
						isClosable: true,
						position: 'top',
					});
				}
				localStorage.setItem('appVersion', data.version);
			} catch (e) {
				console.log('Version check failed', e);
			}
		};
		checkVersion();
	}, [toast]);

	return (
		<Box bg='bg' minH='100vh' maxW='600px' mx='auto' position='relative' borderLeft='1px solid' borderRight='1px solid' borderColor='border' pb='env(safe-area-inset-bottom, 0px)'>
			<TopNav />
			<Box pt='calc(48px + env(safe-area-inset-top, 0px))' pb='100px' minH='100vh'>
				<Outlet />
			</Box>
			<GlobalActionMenu />
			<BottomNav />
		</Box>
	);
};

const App = () => (
	<ChakraProvider theme={theme}>
		<AuthProvider>
			<BrowserRouter>
				<Routes>
					<Route path='/login' element={<LoginPage />} />
					<Route path='/signup' element={<SignupPage />} />
					<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
						<Route path='/' element={<DashboardPage />} />
						<Route path='/ledger' element={<LedgerPage />} />
						<Route path='/splitwise' element={<SplitwisePage />} />
						<Route path='/chores' element={<ChoresPage />} />
						<Route path='/casino' element={<CasinoPage />} />
						<Route path='/casino/:id' element={<MarketPage />} />
						<Route path='/perks' element={<PerksPage />} />
						<Route path='/admin' element={<AdminPage />} />
					</Route>
				</Routes>
			</BrowserRouter>
		</AuthProvider>
	</ChakraProvider>
);

export default App;
