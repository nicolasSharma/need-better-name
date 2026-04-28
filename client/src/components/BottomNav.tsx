import { Box, Flex, Icon, Text } from '@chakra-ui/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoHome, IoList, IoDice, IoGift, IoSettings, IoWallet } from 'react-icons/io5';
import { useUser } from '@/hooks/useUser';

const navItems = [
	{ label: 'Home', icon: IoHome, path: '/' },
	{ label: 'Treasury', icon: IoList, path: '/ledger' },
	{ label: 'Wallet', icon: IoWallet, path: '/splitwise' },
	{ label: 'Casino', icon: IoDice, path: '/casino' },
	{ label: 'Chores', icon: IoGift, path: '/chores' },
];

const BottomNav = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { profile } = useUser();

	const activeNavs = [...navItems];
	if (profile?.isAdmin) {
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
			py={2}
			pb={{ base: 6, md: 2 }} // safe area for iOS
			zIndex={999}
		>
			<Flex justify='space-around' align='center' maxW='500px' mx='auto'>
				{activeNavs.map((item) => {
					const active = location.pathname === item.path;
					return (
						<Flex
							key={item.path}
							onClick={() => navigate(item.path)}
							direction='column'
							align='center'
							justify='center'
							cursor='pointer'
							w='60px'
							color={active ? 'primaryAction' : 'textSecondary'}
							transition='color 0.2s'
							_active={{ transform: 'scale(0.9)' }}
						>
							<Icon as={item.icon} boxSize={6} mb={1} />
							<Text fontSize='10px' fontWeight='600'>
								{item.label}
							</Text>
						</Flex>
					);
				})}
			</Flex>
		</Box>
	);
};

export default BottomNav;
