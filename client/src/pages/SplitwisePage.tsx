import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack, Button, HStack, Avatar, useToast, Divider } from '@chakra-ui/react';
import Skeleton from '@/components/Skeleton';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSplitwise } from '@/hooks/useSplitwise';
import { UserProfile } from '@/hooks/useUser';
import { settleDebt } from '@/lib/firestore';
import { triggerHaptic } from '@/lib/haptics';
import { useUser } from '@/hooks/useUser';
import TutorialWizard from '@/components/TutorialWizard';
import { IoCardOutline, IoWalletOutline, IoAddCircleOutline } from 'react-icons/io5';

interface Roommate extends UserProfile {
	id: string;
}

const SplitwisePage = () => {
	const { user } = useAuth();
	const { optimizedRoutes, myTotalOwed, myTotalDebt, loading } = useSplitwise();
	const toast = useToast();

	const { profile } = useUser();
	const [roommates, setRoommates] = useState<any[]>([]);

	useEffect(() => {
		const fetchUsers = async () => {
			const snap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
			setRoommates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
		};
		fetchUsers();
	}, []);

	const handleSettle = async (targetUserId: string, amIOwing: boolean, amount: number) => {
		if (!user) return;
		triggerHaptic();
		try {
			// Record the physical real-world payment
			if (amIOwing) {
				await settleDebt(user.uid, targetUserId, amount);
			} else {
				await settleDebt(targetUserId, user.uid, amount);
			}
			toast({ title: 'Payment Logged!', description: 'Graph recalculating...', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error logging payment', status: 'error' });
		}
	}

	return (
		<Box pb='100px'>
			<TutorialWizard 
				pageKey="wallet" 
				steps={[
					{
						title: "USD Graph",
						body: "We automatically simplify complex group debts into the fewest possible physical payments between roommates.",
						icon: IoCardOutline
					},
					{
						title: "Physical Settlement",
						body: "When you pay a roommate in the real world (Cash, Venmo, etc.), use the 'Settle' button to update the graph.",
						icon: IoWalletOutline
					},
					{
						title: "Add Expense",
						body: "Remember you can always use the (+) button at the bottom of the app to log new shared expenses instantly.",
						icon: IoAddCircleOutline
					}
				]} 
			/>

			{/* Header Summary */}
			<Box bg='surfaceDeep' borderBottom='1px solid' borderColor='border' px={6} py={8} mb={6}>
				<Text fontSize='10px' color='textSecondary' letterSpacing='widest' fontWeight='700' textTransform='uppercase' mb={4}>
					Real Money (USD)
				</Text>
				<Flex justify='space-between' align='center'>
					<Box>
						<Text fontSize='3xl' fontWeight='800' color='yesAction' fontFamily='JetBrains Mono'>
							${myTotalOwed.toFixed(2)}
						</Text>
						<Text fontSize='12px' color='textSecondary'>Total owed to you</Text>
					</Box>
					<Box textAlign='right'>
						<Text fontSize='3xl' fontWeight='800' color='noAction' fontFamily='JetBrains Mono'>
							${myTotalDebt.toFixed(2)}
						</Text>
						<Text fontSize='12px' color='textSecondary'>Total you owe</Text>
					</Box>
				</Flex>
			</Box>

			{/* Optimized Routes */}
			<Box px={4} maxW='600px' mx='auto'>
				<Heading size='md' color='textPrimary' mb={1} fontWeight='700'>
					Action Items
				</Heading>
				<Text fontSize='xs' color='textSecondary' mb={4}>
					These edges are optimized. You may be asked to pay someone you didn't directly borrow from to settle the house.
				</Text>

				{loading ? (
					<VStack spacing={4} mt={4}>
						<Skeleton h='72px' borderRadius='16px' />
						<Skeleton h='72px' borderRadius='16px' />
						<Skeleton h='72px' borderRadius='16px' />
					</VStack>
				) : optimizedRoutes.length === 0 ? (
					<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={6} textAlign='center'>
						<Text color='textSecondary'>You are completely settled up with the house.</Text>
					</Box>
				) : (
					<VStack spacing={0} align='stretch' bg='surface' borderRadius='16px' border='1px solid' borderColor='border' overflow='hidden'>
						{optimizedRoutes.map((route, idx, arr) => {
							const amIOwing = route.fromId === user?.uid;
							const friendId = amIOwing ? route.toId : route.fromId;
							const friend = roommates.find(r => r.id === friendId);

							return (
								<Box key={idx}>
									<Flex justify='space-between' align='center' p={4}>
										<HStack spacing={3}>
											<Avatar size='sm' name={friend?.displayName || 'Unknown'} bg={friend?.color || 'gray.500'} color='white' />
											<Box>
												<Text fontWeight='600' color='textPrimary' lineHeight='1.2'>
													{friend?.displayName || 'Unknown'}
												</Text>
												<Text fontSize='12px' color={amIOwing ? 'noAction' : 'yesAction'} fontWeight='600'>
													{amIOwing ? `You must pay` : `Needs to pay you`}
												</Text>
											</Box>
										</HStack>
										
										<HStack spacing={4}>
											<Text fontFamily='JetBrains Mono' fontWeight='700' fontSize='lg' color={amIOwing ? 'noAction' : 'yesAction'}>
												${route.amount.toFixed(2)}
											</Text>
											<Button size='sm' variant='surface' onClick={() => handleSettle(friendId, amIOwing, route.amount)}>
												Settle
											</Button>
										</HStack>
									</Flex>
									{idx < arr.length - 1 && <Divider borderColor='border' ml={14} w='calc(100% - 56px)' />}
								</Box>
							);
						})}
					</VStack>
				)}
			</Box>

		</Box>
	);
};

export default SplitwisePage;
