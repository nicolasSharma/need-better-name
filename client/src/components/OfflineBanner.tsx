import { useState, useEffect } from 'react';
import { Box, Flex, Text, Icon, Slide } from '@chakra-ui/react';
import { IoWifiOutline } from 'react-icons/io5';

const OfflineBanner = () => {
	const [isOffline, setIsOffline] = useState(!navigator.onLine);

	useEffect(() => {
		const handleOnline = () => setIsOffline(false);
		const handleOffline = () => setIsOffline(true);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	return (
		<Slide direction='top' in={isOffline} style={{ zIndex: 1000 }}>
			<Box bg='red.500' color='white' py={2} px={4} textAlign='center' shadow='md'>
				<Flex align='center' justify='center' gap={2}>
					<Icon as={IoWifiOutline} />
					<Text fontSize='xs' fontWeight='700' letterSpacing='wide' textTransform='uppercase'>
						You are currently offline
					</Text>
				</Flex>
			</Box>
		</Slide>
	);
};

export default OfflineBanner;
