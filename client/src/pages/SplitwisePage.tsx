import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Flex, Heading, Text, VStack, Button, HStack, Avatar, useToast, Divider, Icon, Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react';
import Skeleton from '@/components/Skeleton';
import { useAuth } from '@/context/AuthProvider';
import { useSplitwise } from '@/hooks/useSplitwise';
import { settleDebt } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { useUser, useRoommates } from '@/context/AppDataProvider';
import TutorialWizard from '@/components/TutorialWizard';
import PullToRefresh from '@/components/PullToRefresh';
import EmptyState from '@/components/EmptyState';
import { IoCardOutline, IoWalletOutline, IoAddCircleOutline, IoCheckmarkDoneCircleOutline, IoReceiptOutline, IoPersonOutline } from 'react-icons/io5';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';

const SplitwisePage = () => {
	const { user } = useAuth();
	const { optimizedRoutes, myTotalOwed, myTotalDebt, loading } = useSplitwise();
	const toast = useToast();
	const { profile } = useUser();
	const { roommates } = useRoommates();

	// Expense history
	const [expenses, setExpenses] = useState<any[]>([]);
	const [expensesLoading, setExpensesLoading] = useState(true);

	useEffect(() => {
		const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(50));
		const unsub = onSnapshot(q, (snap) => {
			setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
			setExpensesLoading(false);
		});
		return unsub;
	}, []);

	const roommateMap = useMemo(() => {
		const map: Record<string, string> = {};
		roommates.forEach(r => { map[r.id] = r.displayName?.split(' ')[0] || 'User'; });
		return map;
	}, [roommates]);

	const handleSettle = async (targetUserId: string, amIOwing: boolean, amount: number) => {
		if (!user) return;
		triggerHaptic();
		try {
			if (amIOwing) {
				await settleDebt(user.uid, targetUserId, amount);
				// Try to open Venmo for payment
				const target = roommates.find(r => r.id === targetUserId);
				if (target) {
					// Fallback note in case we don't have their venmo handle
					const venmoUrl = `venmo://paycharge?txn=pay&amount=${amount.toFixed(2)}&note=Hub%20Settlement`;
					window.location.href = venmoUrl;
					// Note: If venmo app isn't installed, nothing happens (which is fine, the user just logged it)
				}
			} else {
				await settleDebt(targetUserId, user.uid, amount);
			}
			toast({ title: 'Payment Logged!', description: 'Graph recalculating...', status: 'success' });
		} catch (e: any) {
			toast({ title: 'Error logging payment', description: e.message, status: 'error' });
		}
	}

	const handleRefresh = useCallback(async () => {
		await new Promise(r => setTimeout(r, 400));
	}, []);

	return (
		<PullToRefresh onRefresh={handleRefresh}>
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
			<Box bg='surfaceDeep' borderBottom='1px solid' borderColor='border' px={6} py={8} mb={0}>
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

			{/* Tabs */}
			<Tabs isFitted variant='unstyled'>
				<TabList bg='surface' borderBottom='1px solid' borderColor='border'>
					<Tab 
						_selected={{ color: 'primaryAction', borderBottom: '2px solid', borderColor: 'primaryAction' }} 
						fontWeight='800' fontSize='xs' letterSpacing='wider' py={3}
					>
						ACTION ITEMS
					</Tab>
					<Tab 
						_selected={{ color: 'primaryAction', borderBottom: '2px solid', borderColor: 'primaryAction' }} 
						fontWeight='800' fontSize='xs' letterSpacing='wider' py={3}
					>
						EXPENSE LOG
					</Tab>
				</TabList>

				<TabPanels>
					{/* Settlement Routes Tab */}
					<TabPanel px={4} pt={6}>
						<Text fontSize='xs' color='textSecondary' mb={4}>
							Optimized routes — you may be asked to pay someone you didn't directly borrow from.
						</Text>

						{loading ? (
							<VStack spacing={4}>
								<Skeleton h='72px' borderRadius='16px' />
								<Skeleton h='72px' borderRadius='16px' />
								<Skeleton h='72px' borderRadius='16px' />
							</VStack>
						) : optimizedRoutes.length === 0 ? (
							<EmptyState
								icon={IoCheckmarkDoneCircleOutline}
								title='All Clear ✨'
								subtitle='You are completely settled up with the house.'
							/>
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
					</TabPanel>

					{/* Expense History Tab */}
					<TabPanel px={4} pt={6}>
						{expensesLoading ? (
							<VStack spacing={4}>
								<Skeleton h='72px' borderRadius='16px' />
								<Skeleton h='72px' borderRadius='16px' />
							</VStack>
						) : expenses.length === 0 ? (
							<EmptyState
								icon={IoReceiptOutline}
								title='No expenses yet'
								subtitle='Use the + button to log a shared expense.'
							/>
						) : (
							<VStack spacing={0} align='stretch' bg='surface' borderRadius='16px' border='1px solid' borderColor='border' overflow='hidden'>
								{expenses.map((expense, idx) => {
									const payerName = roommateMap[expense.payerId] || 'Unknown';
									const splitNames = (expense.splitWith || [])
										.map((id: string) => roommateMap[id] || '?')
										.join(', ');
									const isMyExpense = expense.payerId === user?.uid;
									const amountPerPerson = expense.splitWith?.length 
										? (expense.amountUSD / expense.splitWith.length).toFixed(2) 
										: expense.amountUSD?.toFixed(2);
									const dateStr = expense.createdAt?.toDate?.()?.toLocaleDateString('en-US', { 
										month: 'short', day: 'numeric'
									}) || 'Recent';

									return (
										<Box key={expense.id}>
											<Box p={4}>
												<Flex justify='space-between' align='start' mb={1}>
													<Box flex={1}>
														<Text fontWeight='700' fontSize='sm' color='textPrimary'>{expense.title}</Text>
														<HStack spacing={1} mt={0.5}>
															<Icon as={IoPersonOutline} boxSize={3} color='textSecondary' />
															<Text fontSize='11px' color={isMyExpense ? 'primaryAction' : 'textSecondary'} fontWeight='600'>
																{isMyExpense ? 'You paid' : `${payerName} paid`}
															</Text>
														</HStack>
													</Box>
													<VStack spacing={0} align='end'>
														<Text fontFamily='JetBrains Mono' fontWeight='800' fontSize='md' color='textPrimary'>
															${expense.amountUSD?.toFixed(2)}
														</Text>
														<Text fontSize='10px' color='textSecondary'>{dateStr}</Text>
													</VStack>
												</Flex>
												<Flex mt={2} gap={1} flexWrap='wrap'>
													{(expense.splitWith || []).map((id: string) => (
														<Box 
															key={id} 
															bg={id === user?.uid ? 'rgba(10,132,255,0.15)' : 'surfaceDeep'} 
															px={2} py={0.5} borderRadius='6px'
															border='1px solid'
															borderColor={id === user?.uid ? 'primaryAction' : 'border'}
														>
															<Text fontSize='10px' fontWeight='700' color={id === user?.uid ? 'primaryAction' : 'textSecondary'}>
																{roommateMap[id] || '?'} · ${amountPerPerson}
															</Text>
														</Box>
													))}
												</Flex>
											</Box>
											{idx < expenses.length - 1 && <Divider borderColor='border' />}
										</Box>
									);
								})}
							</VStack>
						)}
					</TabPanel>
				</TabPanels>
			</Tabs>

		</Box>
		</PullToRefresh>
	);
};

export default SplitwisePage;
