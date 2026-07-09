import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoHome, IoList, IoDice, IoGift, IoSettings, IoWallet, IoTrophyOutline } from 'react-icons/io5';
import { useUser } from '@/context/AppDataProvider';
import { isSystemAdmin } from '@/lib/admin';
import { triggerHaptic } from '@/lib/haptics';

const navItems = [
	{ label: 'Home', icon: IoHome, path: '/' },
	{ label: 'Leaderboard', icon: IoTrophyOutline, path: '/leaderboard' },
	{ label: 'Wallet', icon: IoWallet, path: '/splitwise' },
	{ label: 'Casino', icon: IoDice, path: '/casino' },
	{ label: 'Chores', icon: IoGift, path: '/chores' },
];


const BottomNav = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { profile } = useUser();

	const activeNavs = isSystemAdmin(profile?.displayName) 
		? [{ label: 'Admin', icon: IoSettings, path: '/admin' }]
		: [...navItems];
	
	if (profile?.isAdmin && !isSystemAdmin(profile?.displayName)) {
		activeNavs.push({ label: 'Admin', icon: IoSettings, path: '/admin' });
	}

	return (
		<Box
			position='fixed'
			bottom={0}
			left={0}
			right={0}
			bg='bg'
			borderTop='1px solid'
			borderColor='border'
			px={2}
			pt={2}
			pb='calc(env(safe-area-inset-bottom, 8px) + 4px)'
			zIndex={999}
		>
			<Flex justify='space-around' align='center' maxW='500px' mx='auto'>
				{activeNavs.map((item) => {
					const active = location.pathname === item.path;
					return (
						<Flex
							key={item.path}
							onClick={() => { triggerHaptic(); navigate(item.path); }}
							direction='column'
							align='center'
							justify='center'
							cursor='pointer'
							w='60px'
							color={active ? 'primaryAction' : 'textSecondary'}
							transition='color 0.2s'
							_active={{ transform: 'scale(0.9)' }}
						>
							<Icon as={item.icon} boxSize={6} mb={0.5} transition='transform 0.15s' transform={active ? 'scale(1.1)' : 'scale(1)'} />
							<Text fontSize='10px' fontWeight='600'>
								{item.label}
							</Text>
							<Box w='4px' h='4px' borderRadius='full' bg={active ? 'primaryAction' : 'transparent'} mt={0.5} transition='background 0.2s' />
						</Flex>
					);
				})}
			</Flex>
		</Box>
	);
};

export default BottomNav;
