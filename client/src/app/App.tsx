import React, { useEffect } from 'react';
import { ChakraProvider, Box, Heading, Text, Button, useToast } from '@chakra-ui/react';
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
import GamesPage from '@/pages/GamesPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import BottomNav from '@/components/BottomNav';
import TopNav from '@/components/TopNav';
import { GlobalActionMenu } from '@/components/GlobalActionMenu';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
	constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
	static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
	componentDidCatch(error: any, info: any) { console.error("Boundary Caught:", error, info); }
	render() {
		if (this.state.hasError) {
			return (
				<Box p={10} bg='red.900' color='white' minH='100vh'>
					<Heading size='lg' mb={4}>Something went wrong.</Heading>
					<Text fontFamily='mono' fontSize='sm' bg='rgba(0,0,0,0.3)' p={4} borderRadius='8px'>
						{this.state.error?.toString()}
					</Text>
					<Button mt={6} colorScheme='whiteAlpha' onClick={() => window.location.reload()}>Reload Page</Button>
				</Box>
			);
		}
		return this.props.children;
	}
}

const AppLayout = () => {
	console.log("AppLayout Mounting...");
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
				<ErrorBoundary>
					<Outlet />
				</ErrorBoundary>
			</Box>
			<GlobalActionMenu />
			<BottomNav />
		</Box>
	);
};

const App = () => (
	<ChakraProvider theme={theme}>
		<ErrorBoundary>
			<AuthProvider>
				<BrowserRouter>
					<Routes>
						<Route path='/login' element={<LoginPage />} />
						<Route path='/signup' element={<SignupPage />} />
						<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
							<Route path='/' element={<DashboardPage />} />
							<Route path='/leaderboard' element={<ErrorBoundary><LedgerPage /></ErrorBoundary>} />
							<Route path='/splitwise' element={<SplitwisePage />} />
							<Route path='/chores' element={<ChoresPage />} />
							<Route path='/casino' element={<ErrorBoundary><CasinoPage /></ErrorBoundary>} />
							<Route path='/casino/games' element={<GamesPage />} />
							<Route path='/casino/:id' element={<MarketPage />} />
							<Route path='/perks' element={<PerksPage />} />
							<Route path='/admin' element={<AdminPage />} />
						</Route>
					</Routes>
				</BrowserRouter>
			</AuthProvider>
		</ErrorBoundary>
	</ChakraProvider>
);

export default App;
