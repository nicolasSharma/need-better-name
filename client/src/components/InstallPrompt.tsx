import { useState, useEffect } from 'react';
import { Box, Flex, Text, Icon, Button, VStack, HStack, keyframes } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoPhonePortraitOutline, IoShareOutline, IoAddCircleOutline, IoCheckmarkCircle } from 'react-icons/io5';
import { triggerHaptic } from '@/lib/haptics';

const pulse = keyframes`
	0%, 100% { box-shadow: 0 0 0 0 rgba(10, 132, 255, 0.3); }
	50% { box-shadow: 0 0 0 10px rgba(10, 132, 255, 0); }
`;

const InstallPrompt = () => {
	const [show, setShow] = useState(false);
	const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
	const [isIOS, setIsIOS] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		// Don't show if already installed or dismissed this session
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches
			|| (window.navigator as any).standalone === true;
		if (isStandalone) return;

		const wasDismissed = sessionStorage.getItem('pwa_install_dismissed');
		if (wasDismissed) return;

		// iOS detection
		const ua = navigator.userAgent;
		const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
		setIsIOS(isiOS);

		if (isiOS) {
			// On iOS, show after a short delay
			const timer = setTimeout(() => setShow(true), 2000);
			return () => clearTimeout(timer);
		}

		// Chrome/Android: listen for beforeinstallprompt
		const handler = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e);
			setTimeout(() => setShow(true), 1500);
		};
		window.addEventListener('beforeinstallprompt', handler);
		return () => window.removeEventListener('beforeinstallprompt', handler);
	}, []);

	const handleInstall = async () => {
		triggerHaptic();
		if (deferredPrompt) {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') {
				setShow(false);
			}
			setDeferredPrompt(null);
		}
	};

	const handleDismiss = () => {
		triggerHaptic();
		setDismissed(true);
		setShow(false);
		sessionStorage.setItem('pwa_install_dismissed', 'true');
	};

	if (!show || dismissed) return null;

	return (
		<AnimatePresence>
			<Box
				as={motion.div}
				initial={{ opacity: 0, height: 0, marginBottom: 0 }}
				animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
				exit={{ opacity: 0, height: 0, marginBottom: 0 }}
			>
				<Box
					bg='surface'
					borderRadius='20px'
					border='1px solid'
					borderColor='primaryAction'
					p={5}
					position='relative'
					overflow='hidden'
				>
					{/* Glow accent */}
					<Box
						position='absolute'
						top='-30px'
						right='-30px'
						w='100px'
						h='100px'
						bg='primaryAction'
						opacity={0.06}
						borderRadius='full'
						filter='blur(30px)'
					/>

					<HStack spacing={4} align='start'>
						<Flex
							w='48px' h='48px' minW='48px'
							bg='rgba(10,132,255,0.12)'
							borderRadius='14px'
							align='center' justify='center'
							animation={`${pulse} 2s ease-in-out infinite`}
						>
							<Icon as={IoPhonePortraitOutline} boxSize={6} color='primaryAction' />
						</Flex>

						<Box flex={1}>
							<Text fontWeight='800' fontSize='sm' color='textPrimary' mb={0.5}>
								Install The Hub
							</Text>
							{isIOS ? (
								<VStack align='start' spacing={1}>
									<Text fontSize='xs' color='textSecondary' lineHeight='1.4'>
										Tap <Icon as={IoShareOutline} boxSize={3} mx={0.5} /> then <strong>"Add to Home Screen"</strong> for the full app experience.
									</Text>
								</VStack>
							) : (
								<Text fontSize='xs' color='textSecondary' lineHeight='1.4'>
									Get instant access from your home screen with push notifications.
								</Text>
							)}

							<HStack spacing={2} mt={3}>
								{!isIOS && deferredPrompt && (
									<Button
										size='sm'
										bg='primaryAction'
										color='white'
										borderRadius='10px'
										fontWeight='800'
										fontSize='xs'
										onClick={handleInstall}
										leftIcon={<Icon as={IoAddCircleOutline} />}
										_active={{ transform: 'scale(0.95)' }}
									>
										Install
									</Button>
								)}
								<Button
									size='sm'
									variant='ghost'
									color='textSecondary'
									borderRadius='10px'
									fontWeight='700'
									fontSize='xs'
									onClick={handleDismiss}
								>
									Not now
								</Button>
							</HStack>
						</Box>
					</HStack>
				</Box>
			</Box>
		</AnimatePresence>
	);
};

export default InstallPrompt;
