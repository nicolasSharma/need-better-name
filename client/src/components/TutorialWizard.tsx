import { useState, useEffect } from 'react';
import { 
	Box, Flex, Text, Heading, Button, Modal, ModalOverlay, ModalContent, ModalHeader, 
	ModalBody, ModalFooter, VStack, Icon, Image, UnorderedList, ListItem,
	useToast, Progress, HStack, Spinner
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
	IoNotificationsOutline, IoAddCircleOutline, IoStatsChartOutline, 
	IoCheckmarkCircleOutline, IoCardOutline, IoWalletOutline, IoArrowForwardOutline 
} from 'react-icons/io5';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { markTutorialViewed, completeSetup } from '@/lib/firestore';

interface Step {
	title: string;
	body: string;
	icon: any;
	image?: string;
	actionLabel?: string;
	action?: () => void;
	specialType?: 'ios_share';
}

interface Props {
	pageKey: string;
	steps: Step[];
	isSetup?: boolean;
}

const TutorialWizard = ({ pageKey, steps, isSetup = false }: Props) => {
	const { user } = useAuth();
	const { profile } = useUser();
	const [isOpen, setIsOpen] = useState(false);
	const [currentStep, setCurrentStep] = useState(0);
	const [loading, setLoading] = useState(false);
	const toast = useToast();

	useEffect(() => {
		if (!profile) return;
		
		if (isSetup && !profile.setupComplete) {
			setIsOpen(true);
		} else if (!isSetup && !profile.viewedTutorials?.includes(pageKey)) {
			// Check if setup is already done before showing page tutorials
			if (profile.setupComplete) {
				setIsOpen(true);
			}
		}
	}, [profile, pageKey, isSetup]);

	const handleNext = async () => {
		if (currentStep < steps.length - 1) {
			setCurrentStep(currentStep + 1);
		} else {
			setLoading(true);
			try {
				if (user) {
					if (isSetup) {
						await completeSetup(user.uid);
					} else {
						await markTutorialViewed(user.uid, pageKey);
					}
				}
				setIsOpen(false);
			} catch (e) {
				console.error(e);
			}
			setLoading(false);
		}
	};

	const requestNotifications = async () => {
		if (!('Notification' in window)) {
			toast({ title: 'Push Unsupported', description: 'On iOS, you must Add to Home Screen first before enabling notifications.', status: 'info', duration: 5000 });
			handleNext();
			return;
		}
		try {
			const permission = await Notification.requestPermission();
			if (permission === 'granted') {
				toast({ title: 'Notifications Enabled', status: 'success' });
			}
		} catch (e) {
			console.log('Notification request failed', e);
		}
		handleNext();
	};

	if (!isOpen) return null;

	const step = steps[currentStep];

	return (
		<Modal isOpen={isOpen} onClose={() => {}} isCentered closeOnOverlayClick={false} size='md'>
			<ModalOverlay backdropFilter='blur(12px) saturate(180%)' bg='rgba(0,0,0,0.4)' />
			<ModalContent 
				bg='surface' 
				borderRadius='28px' 
				overflow='hidden' 
				border='1px solid' 
				borderColor='border'
				mx={4}
				shadow='2xl'
			>
				<Box p={6} pb={0}>
					<HStack justify='space-between' mb={6}>
						<Text fontSize='10px' fontWeight='800' color='primaryAction' letterSpacing='widest' textTransform='uppercase'>
							{isSetup ? 'System Onboarding' : `${pageKey.toUpperCase()} Guide`}
						</Text>
						<Text fontSize='10px' color='textSecondary' fontWeight='700'>
							{currentStep + 1} / {steps.length}
						</Text>
					</HStack>
					<Progress value={((currentStep + 1) / steps.length) * 100} size='xs' borderRadius='full' bg='bg' colorScheme='blue' mb={8} />
				</Box>

				<ModalBody px={8} pb={10}>
					<AnimatePresence mode='wait'>
						<motion.div
							key={currentStep}
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -20 }}
							transition={{ duration: 0.3 }}
						>
							<VStack spacing={6} align='center' textAlign='center'>
								<Box 
									bg='primaryAction' 
									color='white' 
									p={5} 
									borderRadius='24px' 
									shadow='lg'
									mb={2}
								>
									<Icon as={step.icon} boxSize={8} />
								</Box>

								<VStack spacing={2}>
									<Heading size='md' fontWeight='900' color='textPrimary'>
										{step.title}
									</Heading>
									<Text color='textSecondary' fontSize='sm' lineHeight='tall'>
										{step.body}
									</Text>
								</VStack>

								{step.image && (
									<Box borderRadius='16px' overflow='hidden' border='1px solid' borderColor='border' shadow='inner' bg='bg' p={2}>
										<Image src={step.image} maxH='160px' objectFit='contain' />
									</Box>
								)}
							</VStack>
						</motion.div>
					</AnimatePresence>
				</ModalBody>

				<ModalFooter bg='bg' p={6}>
					{step.actionLabel ? (
						<Button 
							w='100%' 
							h='60px' 
							bg='primaryAction' 
							color='white' 
							_hover={{ opacity: 0.9 }} 
							onClick={step.action || requestNotifications}
							rightIcon={<IoArrowForwardOutline />}
						>
							{step.actionLabel}
						</Button>
					) : (
						<Button 
							w='100%' 
							h='60px' 
							bg='textPrimary' 
							color='surface' 
							_hover={{ opacity: 0.9 }} 
							onClick={handleNext}
							isLoading={loading}
							spinner={<Spinner size='sm' />}
						>
							{currentStep === steps.length - 1 ? 'Get Started' : 'Next Step'}
						</Button>
					)}
				</ModalFooter>
			</ModalContent>

			{/* iOS Share Pointer */}
			{step.specialType === 'ios_share' && (
				<Box
					position='fixed'
					bottom='env(safe-area-inset-bottom, 20px)'
					left='50%'
					transform='translateX(-50%)'
					zIndex={2000}
					textAlign='center'
				>
					<motion.div
						initial={{ y: 20, opacity: 0 }}
						animate={{ y: [0, -20, 0], opacity: 1 }}
						transition={{ 
							y: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
							opacity: { duration: 0.5 }
						}}
					>
						<VStack spacing={2}>
							<Text color='white' fontWeight='900' textShadow='0 2px 10px rgba(0,0,0,0.5)' fontSize='sm' bg='primaryAction' px={4} py={1} borderRadius='full'>TAP SHARE BELOW</Text>
							<Box w='0' h='0' borderLeft='10px solid transparent' borderRight='10px solid transparent' borderTop='15px solid #0A84FF' margin='0 auto' />
						</VStack>
					</motion.div>
				</Box>
			)}
		</Modal>
	);
};

export default TutorialWizard;
