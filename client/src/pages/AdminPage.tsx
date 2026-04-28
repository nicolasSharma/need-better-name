import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack, Button, Input, HStack, useToast, Divider } from '@chakra-ui/react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useUser, UserProfile } from '@/hooks/useUser';
import { adjustUserBalance, grantAdmin } from '@/lib/firestore';
import { useHouseFund } from '@/hooks/useHouseFund';
import AnimatedNumber from '@/components/AnimatedNumber';

import { IoArrowBack } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

interface AdminUserProfile extends UserProfile {
	id: string;
}

const AdminPage = () => {
	const { user } = useAuth();
	const { profile } = useUser();
	const fund = useHouseFund();
	const toast = useToast();
	const navigate = useNavigate();

	const [users, setUsers] = useState<AdminUserProfile[]>([]);
	const [amounts, setAmounts] = useState<Record<string, string>>({});

	useEffect(() => {
		const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
		return onSnapshot(q, (snap) => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUserProfile))));
	}, []);

	if (profile && !profile.isAdmin) {
		return (
			<Box p={8} textAlign='center'>
				<Text color='textSecondary'>Nice try. You aren't an admin.</Text>
			</Box>
		);
	}

	const handleAdjust = async (targetId: string, isAdd: boolean) => {
		if (!user) return;
		const amt = parseInt(amounts[targetId]) || 0;
		if (amt <= 0) return;

		const finalAmt = isAdd ? amt : -amt;
		try {
			await adjustUserBalance(user.uid, targetId, finalAmt, 'Admin manual override');
			toast({ title: 'Balance updated', status: 'success' });
			setAmounts(prev => ({ ...prev, [targetId]: '' }));
		} catch (e: any) {
			toast({ title: 'Adjustment failed', description: e.message, status: 'error' });
		}
	};

	const handleMakeAdmin = async (targetId: string) => {
		try {
			await grantAdmin(targetId);
			toast({ title: 'Admin granted', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error', status: 'error' });
		}
	};

	return (
		<Box pb={8} bg='surfaceDeep' minH='100vh'>
			{/* Admin Header */}
			<Box pt={10} px={6} pb={8} borderBottom='1px solid' borderColor='border' bg='bg'>
				<Button leftIcon={<IoArrowBack />} variant='ghost' size='sm' onClick={() => navigate('/')} mb={4} color='textSecondary' px={0}>
					Exit Console
				</Button>
				<Heading size='lg' color='textPrimary' mb={2}>Central Governance</Heading>
				<Text color='textSecondary' fontSize='sm'>
					You have root access to The Hub. Be careful.
				</Text>
			</Box>

			{/* The Mint */}
			<Box px={4} mt={6}>
				<Text fontSize='10px' color='textSecondary' letterSpacing='widest' fontWeight='700' textTransform='uppercase' mb={4} px={2}>
					THE MINT
				</Text>
				<VStack spacing={0} align='stretch' bg='surface' borderRadius='16px' border='1px solid' borderColor='border' overflow='hidden'>
					{users.map((u, i) => (
						<Box key={u.id}>
							<Flex justify='space-between' align='center' p={4}>
								<Box flex={1}>
									<Flex align='center' gap={2}>
										<Text fontWeight='600' color='textPrimary'>{u.displayName}</Text>
										{u.isAdmin && <Text fontSize='10px' bg='primaryAction' color='white' px={2} borderRadius='full' fontWeight='700'>ADMIN</Text>}
									</Flex>
									<Text fontFamily='JetBrains Mono' color='yesAction' fontWeight='700' mt={1}>
										{u.balance} BT
									</Text>
								</Box>
								
								<HStack spacing={2}>
									<Input 
										w='80px' 
										placeholder='0' 
										type='number' 
										value={amounts[u.id] || ''} 
										onChange={(e) => setAmounts(prev => ({ ...prev, [u.id]: e.target.value }))}
										bg='bg'
									/>
									<Button size='sm' variant='green' onClick={() => handleAdjust(u.id, true)}>+</Button>
									<Button size='sm' variant='red' onClick={() => handleAdjust(u.id, false)}>-</Button>
								</HStack>
							</Flex>
							{!u.isAdmin && (
								<Flex justify='flex-end' px={4} pb={4} mt={-2}>
									<Text fontSize='xs' color='primaryAction' cursor='pointer' fontWeight='600' onClick={() => handleMakeAdmin(u.id)}>
										Grant Admin
									</Text>
								</Flex>
							)}
							{i < users.length - 1 && <Divider borderColor='border' ml={4} w='calc(100% - 16px)' />}
						</Box>
					))}
				</VStack>
			</Box>

			{/* House Liquidity */}
			<Box px={4} mt={8}>
				<Text fontSize='10px' color='textSecondary' letterSpacing='widest' fontWeight='700' textTransform='uppercase' mb={4} px={2}>
					HOUSE RESERVE
				</Text>
				<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={6}>
					<Text fontSize='sm' color='textSecondary' mb={2}>Total Liquidity (from Taxes & Seed Returns)</Text>
					<Text fontSize='4xl' fontWeight='800' color='primaryAction' fontFamily='JetBrains Mono'>
						<AnimatedNumber value={fund?.fundBalance || 0} /> BT
					</Text>
				</Box>
			</Box>
		</Box>
	);
};

export default AdminPage;
