import { useEffect, useState } from 'react';
import { Box, Text, Flex, Button } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHouseFund } from '@/hooks/useHouseFund';
import { useRoommates } from '@/context/AppDataProvider';
import { useAuth } from '@/context/AuthProvider';
import { playThump } from '@/lib/audio';
import { triggerHaptic } from '@/lib/haptics';

const MotionBox = motion(Box);

const ToastOverlay = () => {
	const fund = useHouseFund();
	const { roommates } = useRoommates();
	const { user } = useAuth();
	const [show, setShow] = useState(false);
	const [toastData, setToastData] = useState<{name: string, isMe: boolean} | null>(null);
	const [processedToasts, setProcessedToasts] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!fund?.lastToast?.timestamp) return;
		
		const toastTime = fund.lastToast.timestamp.toMillis ? fund.lastToast.timestamp.toMillis() : (fund.lastToast.timestamp.seconds * 1000);
		const toastId = `${fund.lastToast.triggeredBy}_${toastTime}`;
		
		if (processedToasts.has(toastId)) return;

		const now = Date.now();
		// Only trigger if it happened in the last 15 seconds
		if (now - toastTime < 15000) {
			const triggerUser = roommates.find(r => r.id === fund.lastToast!.triggeredBy);
			setToastData({
				name: triggerUser?.displayName?.split(' ')[0] || 'Someone',
				isMe: fund.lastToast!.triggeredBy === user?.uid
			});
			setShow(true);
			playThump();
			
			if (typeof navigator !== 'undefined' && navigator.vibrate) {
				navigator.vibrate([400, 100, 400, 100, 800]);
			}

			setProcessedToasts(prev => new Set(prev).add(toastId));

			// Remove auto-timeout so they have to click the button to dismiss!
		}
	}, [fund?.lastToast?.timestamp, roommates, user, processedToasts]);

	const handleDismiss = () => {
		triggerHaptic();
		setShow(false);
	};

	return (
		<AnimatePresence>
			{show && toastData && (
				<MotionBox
					position='fixed'
					top={0}
					left={0}
					right={0}
					bottom={0}
					zIndex={10000}
					display='flex'
					alignItems='center'
					justifyContent='center'
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					{/* Heavy Neon Pulsing Background Layer */}
					<MotionBox
						position='absolute'
						top={0} left={0} right={0} bottom={0}
						bg='radial-gradient(circle, rgba(255, 120, 0, 0.4) 0%, rgba(0, 0, 0, 0.95) 80%)'
						animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
						transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
						backdropFilter='blur(15px)'
					/>

					{/* Content Layer */}
					<Flex direction='column' align='center' position='relative' zIndex={1} px={6}
						as={motion.div} 
						initial={{ scale: 0.5, y: 50 }} 
						animate={{ scale: [1, 1.1, 1], y: 0 }} 
						transition={{ type: 'spring', bounce: 0.6 }}
					>
						<Text fontSize='140px' lineHeight='1' mb={2} as={motion.div} animate={{ rotate: [-15, 15, -15], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.4 }}>
							🍻
						</Text>
						<Text fontSize='5xl' fontWeight='900' color='white' textAlign='center' letterSpacing='tighter' textTransform='uppercase' filter='drop-shadow(0 0 20px rgba(255, 191, 0, 0.8))' lineHeight='1.1'>
							TIME TO DRINK!
						</Text>

						<Button
							mt={12}
							size='lg'
							colorScheme='yellow'
							borderRadius='24px'
							h='72px'
							w='240px'
							fontSize='2xl'
							fontWeight='900'
							boxShadow='0 0 40px rgba(255, 191, 0, 0.6)'
							onClick={handleDismiss}
							as={motion.button}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.9 }}
						>
							LET'S GO! 🚀
						</Button>
					</Flex>
				</MotionBox>
			)}
		</AnimatePresence>
	);
};

export default ToastOverlay;
