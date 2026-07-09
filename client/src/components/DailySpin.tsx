import { useState, useMemo } from 'react';
import { Box, Flex, Text, Button, Icon, HStack, useToast } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoStarOutline, IoFlame } from 'react-icons/io5';
import { useUser } from '@/context/AppDataProvider';
import { useAuth } from '@/context/AuthProvider';
import { claimDailySpin } from '@/lib/services';
import { triggerHaptic } from '@/lib/haptics';
import { playThump, playChime } from '@/lib/audio';
import Confetti from '@/components/Confetti';

const REWARDS = [10, 20, 50, 100, 25, 15];

const DailySpin = () => {
	const { profile } = useUser();
	const { user } = useAuth();
	const toast = useToast();
	const [spinning, setSpinning] = useState(false);
	const [fireConfetti, setFireConfetti] = useState(false);
	const [result, setResult] = useState<number | null>(null);

	const { canSpin, hoursLeft, streak } = useMemo(() => {
		if (!profile) return { canSpin: false, hoursLeft: 0, streak: 0 };
		const lastSpin = profile.lastSpinAt?.toDate() || new Date(0);
		const diffMs = Date.now() - lastSpin.getTime();
		const diffHours = diffMs / (1000 * 60 * 60);
		return {
			canSpin: diffHours >= 24,
			hoursLeft: Math.max(0, 24 - diffHours),
			streak: profile.spinStreak || 0
		};
	}, [profile]);

	const handleSpin = async () => {
		if (!profile || !user || !canSpin) return;
		setSpinning(true);
		triggerHaptic();

		// Animate spinning for 2 seconds
		let tick = 0;
		const interval = setInterval(() => {
			playThump();
			tick++;
			if (tick > 15) {
				clearInterval(interval);
			}
		}, 100);

		await new Promise(r => setTimeout(r, 1800));

		const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)];

		try {
			await claimDailySpin(user.uid, reward);
			setResult(reward);
			setFireConfetti(true);
			playChime();
			setTimeout(() => setFireConfetti(false), 3000);
		} catch (e: any) {
			toast({ title: 'Spin Failed', description: e.message, status: 'error' });
		}
		setSpinning(false);
	};

	if (!profile) return null;

	return (
		<Box bg='surface' borderRadius='16px' border='1px solid' borderColor='border' p={5} mb={6} overflow='hidden' position='relative'>
			<Confetti fire={fireConfetti} />
			
			<Flex justify='space-between' align='center'>
				<Box>
					<HStack spacing={2} mb={1}>
						<Icon as={IoStarOutline} color='yellow.400' />
						<Text fontWeight='900' fontSize='md' color='textPrimary'>Daily Spin</Text>
						{streak > 0 && (
							<HStack spacing={1} bg='rgba(255,149,0,0.15)' px={2} py={0.5} borderRadius='full'>
								<Icon as={IoFlame} color='orange.400' boxSize={3} />
								<Text fontSize='10px' fontWeight='800' color='orange.400'>{streak}</Text>
							</HStack>
						)}
					</HStack>
					<Text fontSize='xs' color='textSecondary'>
						{canSpin ? 'Spin the wheel for free BT!' : `Next spin in ${Math.ceil(hoursLeft)} hours`}
					</Text>
				</Box>

				<Button 
					colorScheme='yellow' 
					size='sm' 
					isLoading={spinning} 
					isDisabled={!canSpin && !result}
					onClick={handleSpin}
					boxShadow={canSpin ? '0 0 15px rgba(236,201,75,0.4)' : 'none'}
					_active={{ transform: 'scale(0.95)' }}
				>
					{result ? `Won ${result} BT!` : canSpin ? 'Spin Now' : 'Wait'}
				</Button>
			</Flex>
		</Box>
	);
};

export default DailySpin;
