import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack, Button, Input, HStack, useToast, Divider } from '@chakra-ui/react';
import { collection, query, onSnapshot, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useAuth } from '@/context/AuthProvider';
import { useUser } from '@/context/AppDataProvider';
import type { UserProfile } from '@/types';
import { adjustUserBalance, grantAdmin } from '@/lib/services';
import { useHouseFund } from '@/hooks/useHouseFund';
import AnimatedNumber from '@/components/AnimatedNumber';
import { filterHouseMembers } from '@/lib/admin';

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
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	useEffect(() => {
		const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
		return onSnapshot(q, (snap) => {
			const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUserProfile));
			setUsers(filterHouseMembers(allUsers));
		});
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

	const handleSystemReset = async () => {
		if (!window.confirm("Are you sure you want to delete all tasks, close open markets, and reset user balances to 500? This cannot be undone!")) return;
		
		setActionLoading('reset');
		try {
			// 1. Delete all chores
			const choresSnap = await getDocs(collection(db, 'chores'));
			let batch = writeBatch(db);
			let count = 0;
			for (const d of choresSnap.docs) {
				batch.delete(d.ref);
				count++;
				if (count % 400 === 0) {
					await batch.commit();
					batch = writeBatch(db);
				}
			}
			if (count % 400 !== 0) {
				await batch.commit();
			}

			// 2. Resolve open markets as null
			const marketsSnap = await getDocs(collection(db, 'markets'));
			batch = writeBatch(db);
			count = 0;
			for (const d of marketsSnap.docs) {
				const marketData = d.data();
				if (marketData.status === 'open') {
					batch.update(d.ref, {
						status: 'resolved',
						outcome: null,
						resolvedAt: new Date()
					});
					count++;
					if (count % 400 === 0) {
						await batch.commit();
						batch = writeBatch(db);
					}
				}
			}
			if (count % 400 !== 0) {
				await batch.commit();
			}

			// 3. Reset user balances to 500
			const usersSnap = await getDocs(collection(db, 'users'));
			batch = writeBatch(db);
			count = 0;
			for (const d of usersSnap.docs) {
				batch.update(d.ref, {
					balance: 500
				});
				count++;
				if (count % 400 === 0) {
					await batch.commit();
					batch = writeBatch(db);
				}
			}
			if (count % 400 !== 0) {
				await batch.commit();
			}

			toast({ title: 'System Reset Completed', description: 'All tasks deleted, open markets resolved, and balances reset.', status: 'success', duration: 5000 });
		} catch (e: any) {
			toast({ title: 'Reset Failed', description: e.message, status: 'error' });
		}
		setActionLoading(null);
	};

	return (
		<Box pb={8} bg='surfaceDeep' minH='100vh'>
			{/* Admin Header */}
			<Box pt={10} px={6} pb={8} borderBottom='1px solid' borderColor='border' bg='bg'>
				<Flex justify='space-between' align='center' mb={4}>
					<Button leftIcon={<IoArrowBack />} variant='ghost' size='sm' onClick={() => navigate('/')} color='textSecondary' px={0}>
						Exit Console
					</Button>
					<Button variant='link' colorScheme='red' size='sm' onClick={() => { auth.signOut(); navigate('/login'); }}>
						Log Out
					</Button>
				</Flex>
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

			{/* System Reset */}
			<Box px={4} mt={8} pb={12}>
				<Text fontSize='10px' color='red.400' letterSpacing='widest' fontWeight='700' textTransform='uppercase' mb={4} px={2}>
					SYSTEM RESET
				</Text>
				<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='red.500' p={6}>
					<Text fontSize='sm' color='textSecondary' mb={4}>
						Delete all chores, close open markets to null, and reset roommate balances to 500 BT.
					</Text>
					<Button 
						colorScheme='red' 
						w='100%' 
						h='50px' 
						borderRadius='14px' 
						onClick={handleSystemReset} 
						isLoading={actionLoading === 'reset'}
						fontWeight='800'
					>
						RESET HOUSE DATABASE 🚨
					</Button>
				</Box>
			</Box>
		</Box>
	);
};

export default AdminPage;
