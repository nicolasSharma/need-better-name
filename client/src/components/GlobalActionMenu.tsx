import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
	Box, Flex, Text, VStack, HStack, Button, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, 
	useDisclosure, Icon, Avatar, Input, NumberInput, NumberInputField, Divider, Switch, Select, IconButton,
	useToast, Wrap, WrapItem
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoAdd, IoWalletOutline, IoStatsChartOutline, IoCheckmarkCircleOutline, IoClose, IoTrashOutline, IoRepeatOutline } from 'react-icons/io5';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { filterHouseMembers } from '@/lib/admin';
import { createExpense, createMarket, createChore } from '@/lib/firestore';
import { triggerHaptic } from '@/lib/haptics';
import { playChime } from '@/lib/audio';

const MotionBox = motion(Box);

export const GlobalActionMenu = () => {
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [activeForm, setActiveForm] = useState<'menu' | 'expense' | 'market' | 'task'>('menu');
	const { user } = useAuth();
	const toast = useToast();
	const location = useLocation();

	const [roommates, setRoommates] = useState<any[]>([]);

	useEffect(() => {
		const fetchUsers = async () => {
			const snap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
			setRoommates(filterHouseMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))));
		};
		fetchUsers();
	}, []);

	const handleOpen = () => {
		triggerHaptic();
		if (location.pathname === '/splitwise') setActiveForm('expense');
		else if (location.pathname === '/casino') setActiveForm('market');
		else if (location.pathname === '/chores') setActiveForm('task');
		else setActiveForm('menu');
		onOpen();
	};

	const selectForm = (form: 'menu' | 'expense' | 'market' | 'task') => {
		triggerHaptic();
		setActiveForm(form);
	};

	const allowedPaths = ['/', '/splitwise', '/casino', '/chores'];
	const isDashboard = location.pathname === '/';
	
	if (!allowedPaths.includes(location.pathname)) return null;

	return (
		<>
			{/* Floating Action Button */}
			<Button
				position='fixed'
				bottom={{ base: '90px', md: '100px' }}
				right='20px'
				w='64px'
				h='64px'
				borderRadius='full'
				bg='primaryAction'
				color='white'
				shadow='0 8px 24px rgba(10, 132, 255, 0.4)'
				zIndex={900}
				_hover={{ filter: 'brightness(110%)', transform: 'scale(1.05)' }}
				_active={{ transform: 'scale(0.95)' }}
				onClick={handleOpen}
				p={0}
			>
				<Icon as={IoAdd} boxSize={8} />
			</Button>

			<Drawer placement='bottom' onClose={onClose} isOpen={isOpen} size='full'>
				<DrawerOverlay bg='blackAlpha.600' backdropFilter='blur(8px)' />
				<DrawerContent bg='transparent' shadow='none'>
					<Flex direction='column' justify='flex-end' h='100%' pb={4} px={2} pointerEvents='none'>
						<MotionBox 
							initial={{ y: 100, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: 100, opacity: 0 }}
							pointerEvents='auto'
							bg='surface' 
							borderRadius='24px' 
							border='1px solid' 
							borderColor='border'
							maxH='90vh'
							display='flex'
							flexDirection='column'
							shadow='0 -10px 40px rgba(0,0,0,0.5)'
						>
							<DrawerHeader borderBottomWidth='1px' borderColor='border' pt={6} pb={4} position='relative'>
								<Flex justify='space-between' align='center'>
									<Box>
										<Text fontWeight='900' fontSize='xl' color='textPrimary'>
											{activeForm === 'menu' && 'House Actions'}
											{activeForm === 'expense' && 'Log Expense'}
											{activeForm === 'market' && 'Float Contract'}
											{activeForm === 'task' && 'Dispatch Work'}
										</Text>
										{activeForm !== 'menu' && isDashboard && (
											<Text fontSize='xs' color='textSecondary' mt={1} cursor='pointer' onClick={() => selectForm('menu')} fontWeight='700'>
												← BACK TO MENU
											</Text>
										)}
									</Box>
									<IconButton aria-label="Close" icon={<IoClose />} variant='ghost' onClick={onClose} size='lg' color='textSecondary' />
								</Flex>
							</DrawerHeader>

							<DrawerBody py={6} pb={8} overflowY='auto' sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
								<AnimatePresence mode='wait'>
									{activeForm === 'menu' && <MenuSelection key='menu' onSelect={selectForm} />}
									{activeForm === 'expense' && <ExpenseForm key='expense' roommates={roommates} onClose={onClose} user={user} toast={toast} />}
									{activeForm === 'market' && <MarketForm key='market' roommates={roommates} onClose={onClose} user={user} toast={toast} />}
									{activeForm === 'task' && <TaskForm key='task' roommates={roommates} onClose={onClose} user={user} toast={toast} />}
								</AnimatePresence>
							</DrawerBody>
						</MotionBox>
					</Flex>
				</DrawerContent>
			</Drawer>
		</>
	);
};

// --- MENU SELECTION ---
const MenuSelection = ({ onSelect }: { onSelect: (f: any) => void }) => {
	const actions = [
		{ id: 'expense', title: 'Log USD Expense', desc: 'Add a real-world purchase to the ledger', icon: IoWalletOutline, color: 'yesAction' },
		{ id: 'market', title: 'Float Contract', desc: 'Create a new predictive market', icon: IoStatsChartOutline, color: 'purple.400' },
		{ id: 'task', title: 'Dispatch Work', desc: 'Assign chores or post bounties', icon: IoCheckmarkCircleOutline, color: 'orange.400' }
	];

	return (
		<VStack spacing={4} align='stretch'>
			{actions.map((act) => (
				<MotionBox
					key={act.id}
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					bg='surfaceDeep'
					p={5}
					borderRadius='16px'
					border='1px solid'
					borderColor='border'
					cursor='pointer'
					onClick={() => onSelect(act.id)}
				>
					<HStack spacing={4}>
						<Flex w='50px' h='50px' borderRadius='12px' bg={`${act.color}20`} color={act.color} align='center' justify='center'>
							<Icon as={act.icon} boxSize={6} />
						</Flex>
						<Box>
							<Text fontWeight='800' fontSize='md' color='textPrimary'>{act.title}</Text>
							<Text fontSize='xs' color='textSecondary' fontWeight='600'>{act.desc}</Text>
						</Box>
					</HStack>
				</MotionBox>
			))}
		</VStack>
	);
};

// --- EXPENSE FORM ---
const ExpenseForm = ({ roommates, onClose, user, toast }: any) => {
	const [expenseTitle, setExpenseTitle] = useState('');
	const [expenseAmount, setExpenseAmount] = useState('');
	const [selectedIds, setSelectedIds] = useState<string[]>(roommates.map((r:any) => r.id));
	const [payerId, setPayerId] = useState<string>(user?.uid || '');
	const [submitting, setSubmitting] = useState(false);
	const [pastExpenses, setPastExpenses] = useState<any[]>([]);
	const [showPast, setShowPast] = useState(false);

	useEffect(() => {
		const fetchPast = async () => {
			const snap = await getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(20)));
			const seen = new Set<string>();
			const unique: any[] = [];
			snap.docs.forEach(d => {
				const data = d.data();
				const key = data.title?.toLowerCase();
				if (key && !seen.has(key)) { seen.add(key); unique.push(data); }
			});
			setPastExpenses(unique.slice(0, 6));
		};
		fetchPast();
	}, []);

	const handleReuse = (past: any) => {
		triggerHaptic();
		setExpenseTitle(past.title);
		setExpenseAmount(past.amountUSD.toString());
		const validIds = past.splitWith.filter((id:string) => roommates.some((r:any) => r.id === id));
		setSelectedIds(validIds.length > 0 ? validIds : roommates.map((r:any) => r.id));
	};

	const submit = async () => {
		const amt = parseFloat(expenseAmount);
		if (!user || amt <= 0 || !expenseTitle || selectedIds.length === 0 || !payerId) return;
		setSubmitting(true);
		triggerHaptic();
		try {
			await createExpense(payerId, expenseTitle, amt, selectedIds);
			playChime();
			toast({ title: 'Expense Added to Graph', status: 'success' });
			onClose();
		} catch (e: any) { toast({ title: 'Failed to split', description: e.message, status: 'error' }); }
		setSubmitting(false);
	};

	return (
		<VStack spacing={6} align='stretch' as={motion.div} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
			{pastExpenses.length > 0 && (
				<Box>
					{!showPast ? (
						<Button size='sm' variant='surface' leftIcon={<IoRepeatOutline />} onClick={() => { triggerHaptic(); setShowPast(true); }} w='100%'>
							Show Past Expenses
						</Button>
					) : (
						<Box bg='surfaceDeep' p={3} borderRadius='12px' border='1px solid' borderColor='border'>
							<Flex justify='space-between' align='center' mb={2}>
								<HStack spacing={2}>
									<Icon as={IoRepeatOutline} color='textSecondary' boxSize={4} />
									<Text fontSize='10px' color='textSecondary' fontWeight='800' textTransform='uppercase'>Duplicate Past Expense</Text>
								</HStack>
								<Icon as={IoClose} color='textSecondary' boxSize={4} cursor='pointer' onClick={() => setShowPast(false)} />
							</Flex>
							<Wrap spacing={2}>
								{pastExpenses.map((past, i) => (
									<WrapItem key={i}>
										<Button size='sm' variant='surface' bg='surface' onClick={() => handleReuse(past)} fontSize='11px' h='32px' borderRadius='8px'>
											{past.title} • ${past.amountUSD.toFixed(0)}
										</Button>
									</WrapItem>
								))}
							</Wrap>
						</Box>
					)}
				</Box>
			)}

			<Box>
				<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Description</Text>
				<Input placeholder='e.g. May Internet' value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} autoFocus />
			</Box>
			
			<HStack spacing={4}>
				<Box flex={1}>
					<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Total Amount (USD)</Text>
					<HStack>
						<Text fontSize='2xl' fontWeight='800' color='textSecondary'>$</Text>
						<Input type='number' placeholder='0.00' value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} fontSize='xl' fontWeight='700' fontFamily='JetBrains Mono' />
					</HStack>
				</Box>
				<Box flex={1}>
					<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Paid By</Text>
					<Select value={payerId} onChange={e => setPayerId(e.target.value)} fontSize='md' fontWeight='700' bg='surfaceDeep' h='44px' borderRadius='12px'>
						{roommates.map((r:any) => (
							<option key={r.id} value={r.id}>{r.id === user?.uid ? 'You' : r.displayName}</option>
						))}
					</Select>
				</Box>
			</HStack>

			<Box>
				<Flex justify='space-between' align='center' mb={3}>
					<Text fontSize='11px' color='textSecondary' fontWeight='800' textTransform='uppercase'>Split with</Text>
					<HStack spacing={2}>
						<Button size='xs' variant='surface' onClick={() => { triggerHaptic(); setSelectedIds(roommates.filter((r:any) => r.id !== user?.uid).map((r:any) => r.id)) }}>Others Only</Button>
						<Button size='xs' variant='surface' onClick={() => { triggerHaptic(); setSelectedIds(roommates.map((r:any) => r.id)) }}>Select All</Button>
					</HStack>
				</Flex>
				
				<HStack spacing={3} overflowX='auto' pb={2} sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
					{roommates.map((r:any) => {
						const isSelected = selectedIds.includes(r.id);
						return (
							<VStack key={r.id} spacing={1} cursor='pointer' onClick={() => { triggerHaptic(); setSelectedIds(isSelected ? selectedIds.filter(i => i !== r.id) : [...selectedIds, r.id]) }} opacity={isSelected ? 1 : 0.3}>
								<Box position='relative'>
									<Avatar size='md' name={r.displayName} bg={r.color} border='2px solid' borderColor={isSelected ? 'primaryAction' : 'transparent'} />
									{isSelected && <Box position='absolute' bottom={-1} right={-1} bg='primaryAction' borderRadius='full' p='2px'><Icon as={IoCheckmarkCircleOutline} color='white' boxSize={4} /></Box>}
								</Box>
								<Text fontSize='10px' fontWeight='800' color='textPrimary'>{r.id === user?.uid ? 'You' : r.displayName.split(' ')[0]}</Text>
							</VStack>
						);
					})}
				</HStack>
			</Box>

			<Button w='100%' h='60px' bg='primaryAction' color='white' isLoading={submitting} onClick={submit} isDisabled={!expenseTitle || !expenseAmount || selectedIds.length === 0}>
				Split ${(parseFloat(expenseAmount) / (selectedIds.length || 1)).toFixed(2)} / person
			</Button>
		</VStack>
	);
};

// --- MARKET FORM ---
const MarketForm = ({ roommates, onClose, user, toast }: any) => {
	const [question, setQuestion] = useState('');
	const [betAmount, setBetAmount] = useState('100');
	const [options, setOptions] = useState<string[]>(['YES', 'NO']);
	const [selectedOption, setSelectedOption] = useState('YES');
	const [taggedUser, setTaggedUser] = useState<string>(''); 
	const [submitting, setSubmitting] = useState(false);

	const handleOptionChange = (i: number, v: string) => { const n = [...options]; n[i] = v; setOptions(n); };
	const addOpt = () => { triggerHaptic(); setOptions([...options, '']); };
	const rmOpt = (i: number) => { triggerHaptic(); const n = [...options]; n.splice(i,1); setOptions(n); if(selectedOption === options[i]) setSelectedOption(n[0]); };

	const submit = async () => {
		if (!user || !question) return;
		const clean = options.map(o => o.trim()).filter(o => o !== '');
		if (clean.length < 2) return toast({ title: 'Min 2 options required', status: 'error' });
		setSubmitting(true);
		try {
			await createMarket(question, user.uid, parseInt(betAmount)||100, selectedOption, clean, taggedUser || null);
			triggerHaptic(); toast({ title: 'Contract Floated', status: 'success' }); onClose();
		} catch (e: any) { toast({ title: 'Execution Error', description: e.message, status: 'error' }); }
		setSubmitting(false);
	};

	return (
		<VStack spacing={6} align='stretch' as={motion.div} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
			<Box>
				<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Market Condition</Text>
				<Input placeholder='e.g. Will Jack clean the fridge?' value={question} onChange={(e) => setQuestion(e.target.value)} fontWeight='700' />
			</Box>

			<Box>
				<Flex justify='space-between' align='center' mb={2}>
					<Text fontSize='11px' color='textSecondary' fontWeight='800' textTransform='uppercase'>Options</Text>
					<Button size='xs' leftIcon={<IoAdd />} variant='surface' onClick={addOpt}>Add Choice</Button>
				</Flex>
				<VStack spacing={2} align='stretch'>
					{options.map((opt, idx) => (
						<HStack key={idx}>
							<Input value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} placeholder={`Option ${idx+1}`} size='sm' bg='surfaceDeep' borderRadius='8px' />
							{options.length > 2 && <IconButton aria-label="Del" icon={<IoTrashOutline />} size='sm' variant='ghost' color='noAction' onClick={() => rmOpt(idx)} />}
						</HStack>
					))}
				</VStack>
			</Box>

			<Box>
				<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Seed Liquidity (BT)</Text>
				<NumberInput value={betAmount} onChange={setBetAmount} min={10}>
					<NumberInputField bg='surfaceDeep' fontFamily='JetBrains Mono' fontWeight='800' borderRadius='12px' />
				</NumberInput>
			</Box>

			<HStack spacing={4}>
				<Box flex={1}>
					<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Your Pick</Text>
					<Select value={selectedOption} onChange={e => setSelectedOption(e.target.value)} bg='surfaceDeep' borderRadius='12px' fontWeight='700'>
						{options.filter(o => o.trim()).map((o, i) => <option key={i} value={o}>{o}</option>)}
					</Select>
				</Box>
				<Box flex={1}>
					<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Target Tag</Text>
					<Select value={taggedUser} onChange={e => setTaggedUser(e.target.value)} bg='surfaceDeep' borderRadius='12px'>
						<option value=''>Global Floor</option>
						{roommates.map((r:any) => <option key={r.id} value={r.id}>{r.displayName}</option>)}
					</Select>
				</Box>
			</HStack>

			<Button w='100%' h='60px' bg='primaryAction' color='white' isLoading={submitting} onClick={submit} isDisabled={!question}>
				Launch Contract (-{betAmount || 0} BT)
			</Button>
		</VStack>
	);
};

// --- TASK FORM ---
const TaskForm = ({ roommates, onClose, user, toast }: any) => {
	const [name, setName] = useState('');
	const [reward, setReward] = useState('100');
	const [isBounty, setIsBounty] = useState(false);
	const [recurring, setRecurring] = useState<'none'|'daily'|'weekly'>('none');
	const [assignedTo, setAssignedTo] = useState<string[]>([user?.uid || '']);
	const [assignAll, setAssignAll] = useState(false);
	const [dueDate, setDueDate] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const submit = async () => {
		if (!name || !user) return;
		setSubmitting(true);
		try {
			await createChore(name, parseInt(reward)||100, user.uid, isBounty?'bounty':'house', recurring, assignAll?'all':assignedTo, dueDate||null);
			triggerHaptic(); toast({ title: isBounty ? 'Bounty Posted' : 'Task Created', status: 'success' }); onClose();
		} catch (e: any) { toast({ title: 'Error', description: e.message, status: 'error' }); }
		setSubmitting(false);
	};

	return (
		<VStack spacing={6} align='stretch' as={motion.div} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
			<Flex justify='space-between' align='center' bg='surfaceDeep' p={4} borderRadius='12px' border='1px solid' borderColor='border'>
				<Box>
					<Text color='textPrimary' fontWeight='800' fontSize='sm'>Sponsor via Bounty</Text>
					<Text color='textSecondary' fontSize='10px'>Pay out of your own BT instead of House Funds.</Text>
				</Box>
				<Switch isChecked={isBounty} onChange={(e) => setIsBounty(e.target.checked)} colorScheme='yellow' />
			</Flex>

			<Box>
				<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Description</Text>
				<Input placeholder='e.g. Empty dishwasher' value={name} onChange={e => setName(e.target.value)} />
			</Box>
			
			<Box>
				<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Reward (BT)</Text>
				<NumberInput value={reward} onChange={setReward} min={10}>
					<NumberInputField bg='surfaceDeep' fontFamily='JetBrains Mono' fontWeight='800' borderRadius='12px' />
				</NumberInput>
			</Box>

			{!isBounty && (
				<>
					<HStack spacing={4}>
						<Box flex={1}>
							<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Due Date (Opt)</Text>
							<Input type='date' value={dueDate} onChange={e => setDueDate(e.target.value)} bg='surfaceDeep' borderRadius='12px' />
						</Box>
						<Box flex={1}>
							<Text fontSize='11px' color='textSecondary' mb={1} fontWeight='800' textTransform='uppercase'>Recurrence</Text>
							<Select value={recurring} onChange={e => setRecurring(e.target.value as any)} bg='surfaceDeep' borderRadius='12px'>
								<option value='none'>One-time</option>
								<option value='daily'>Daily</option>
								<option value='weekly'>Weekly</option>
							</Select>
						</Box>
					</HStack>

					<Box>
						<Flex justify='space-between' align='center' mb={3}>
							<Text fontSize='11px' color='textSecondary' fontWeight='800' textTransform='uppercase'>Assigned To</Text>
							<Flex align='center' gap={2}>
								<Text fontSize='10px' color='textSecondary' fontWeight='800'>EVERYONE</Text>
								<Switch isChecked={assignAll} onChange={e => setAssignAll(e.target.checked)} size='sm' />
							</Flex>
						</Flex>
						
						{!assignAll && (
							<HStack spacing={3} overflowX='auto' pb={2} sx={{ '&::-webkit-scrollbar': { display: 'none' } }}>
								{roommates.map((r:any) => {
									const isSel = assignedTo.includes(r.id);
									return (
										<VStack key={r.id} spacing={1} cursor='pointer' onClick={() => { triggerHaptic(); setAssignedTo(isSel ? assignedTo.filter(i => i !== r.id) : [...assignedTo, r.id]) }} opacity={isSel ? 1 : 0.3}>
											<Avatar size='md' name={r.displayName} bg={r.color} border='2px solid' borderColor={isSel ? 'primaryAction' : 'transparent'} />
											<Text fontSize='10px' fontWeight='800' color='textPrimary'>{r.id === user?.uid ? 'You' : r.displayName.split(' ')[0]}</Text>
										</VStack>
									);
								})}
							</HStack>
						)}
					</Box>
				</>
			)}

			<Button w='100%' h='60px' bg={isBounty ? 'yellow.500' : 'textPrimary'} color={isBounty ? 'black' : 'surface'} isLoading={submitting} onClick={submit} isDisabled={!name}>
				{isBounty ? `Post Bounty (-${reward} BT)` : 'Dispatch Task'}
			</Button>
		</VStack>
	);
};
