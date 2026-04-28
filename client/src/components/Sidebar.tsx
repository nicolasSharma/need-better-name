import { Box, VStack, Icon, Text, Flex, Divider } from '@chakra-ui/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoHome, IoCheckmarkDone, IoDice, IoGift, IoLogOut } from 'react-icons/io5';
import { useUser } from '@/hooks/useUser';
import { logOut } from '@/lib/firestore';
import BalanceBadge from '@/components/BalanceBadge';

const navItems = [
	{ label: 'Dashboard', icon: IoHome, path: '/' },
	{ label: 'Chores', icon: IoCheckmarkDone, path: '/chores' },
	{ label: 'Casino', icon: IoDice, path: '/casino' },
	{ label: 'Perks', icon: IoGift, path: '/perks' },
];

const Sidebar = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { profile } = useUser();

	return (
		<Box
			w='240px'
			minH='100vh'
			bg='surface.300'
			borderRight='1px solid'
			borderColor='whiteAlpha.100'
			display='flex'
			flexDir='column'
			py={6}
			px={4}
		>
			<Text fontFamily='Hellix' fontSize='xl' fontWeight='700' color='brand.500' mb={2} px={2} letterSpacing='tight'>
				THE HUB
			</Text>
			{profile && (
				<Box px={2} mb={4}>
					<BalanceBadge balance={profile.balance} />
				</Box>
			)}

			<Divider borderColor='whiteAlpha.100' mb={4} />

			<VStack spacing={1} align='stretch' flex={1}>
				{navItems.map((item) => {
					const active = location.pathname === item.path;
					return (
						<Flex
							key={item.path}
							onClick={() => navigate(item.path)}
							align='center'
							gap={3}
							px={3}
							py='10px'
							borderRadius='10px'
							cursor='pointer'
							bg={active ? 'whiteAlpha.100' : 'transparent'}
							color={active ? 'brand.500' : 'whiteAlpha.600'}
							_hover={{ bg: 'whiteAlpha.50', color: 'white' }}
							transition='all 0.15s'
							fontFamily='Hellix'
							fontWeight='500'
							fontSize='sm'
						>
							<Icon as={item.icon} boxSize={5} />
							<Text>{item.label}</Text>
						</Flex>
					);
				})}
			</VStack>

			<Divider borderColor='whiteAlpha.100' my={4} />
			<Flex
				onClick={() => { logOut(); navigate('/login'); }}
				align='center'
				gap={3}
				px={3}
				py='10px'
				borderRadius='10px'
				cursor='pointer'
				color='whiteAlpha.500'
				_hover={{ bg: 'red.900', color: 'red.300' }}
				transition='all 0.15s'
				fontFamily='Hellix'
				fontSize='sm'
			>
				<Icon as={IoLogOut} boxSize={5} />
				<Text>Log Out</Text>
			</Flex>
		</Box>
	);
};

export default Sidebar;
