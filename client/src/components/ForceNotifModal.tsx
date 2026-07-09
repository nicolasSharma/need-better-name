import { useEffect, useState } from 'react';
import { Box, Flex, Heading, Text, Button, Icon, useToast } from '@chakra-ui/react';
import { IoNotificationsCircle } from 'react-icons/io5';
import { requestNotificationPermission } from '@/lib/notifications';
import { useAuth } from '@/context/AuthProvider';

const ForceNotifModal = () => {
    const { user } = useAuth();
    const [needsPermission, setNeedsPermission] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!user) return; // Don't block logged out users
        
        // Check after a brief delay
        const timer = setTimeout(() => {
            if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'default' || Notification.permission === 'denied') {
                    setNeedsPermission(true);
                }
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [user]);

    const handleEnable = async () => {
        if (!user) return;
        const success = await requestNotificationPermission(user.uid);
        if (success || Notification.permission === 'granted') {
            setNeedsPermission(false);
            toast({ title: 'Notifications Enabled!', status: 'success' });
        } else {
            toast({ title: 'Registration Failed', description: 'Please allow notifications in your browser settings.', status: 'error' });
        }
    };

    if (!needsPermission) return null;

    const isIOSMobileWeb = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && !(navigator as any).standalone;

    return (
        <Box 
            position='fixed' 
            top={0} left={0} right={0} bottom={0} 
            bg='bg' zIndex={9999} 
            display='flex' alignItems='center' justifyContent='center'
            p={6}
        >
            <Flex direction='column' align='center' textAlign='center' maxW='400px' bg='surfaceDeep' p={8} borderRadius='24px' border='1px solid' borderColor='border' boxShadow='xl'>
                <Icon as={IoNotificationsCircle} boxSize={20} color='primaryAction' mb={6} />
                <Heading size='lg' mb={4} fontWeight='900'>Notifications Required</Heading>
                <Text color='textSecondary' mb={8} fontSize='sm'>
                    You must enable push notifications to use The Hub. We use this to alert you about market settlements, chore disputes, and casino events.
                </Text>
                
                {isIOSMobileWeb ? (
                    <Box mt={6} p={5} bg='red.500' color='white' borderRadius='16px' textAlign='left'>
                        <Text fontSize='md' fontWeight='900' mb={2}>
                            ⚠️ iOS Safari Detected
                        </Text>
                        <Text fontSize='sm' mb={3}>
                            Apple requires you to install this app to your Home Screen before you can enable push notifications.
                        </Text>
                        <Box bg='blackAlpha.300' p={3} borderRadius='12px'>
                            <Text fontSize='xs' fontWeight='700'>HOW TO FIX IT:</Text>
                            <Text fontSize='xs' mt={1}>1. Tap the Share icon (the square with an arrow pointing up) at the bottom of Safari.</Text>
                            <Text fontSize='xs' mt={1}>2. Scroll down the list.</Text>
                            <Text fontSize='xs' mt={1}>3. Tap <strong>"Add to Home Screen"</strong>.</Text>
                            <Text fontSize='xs' mt={1}>4. Open the app from your home screen!</Text>
                        </Box>
                    </Box>
                ) : (
                    <Button 
                        colorScheme='blue' 
                        size='lg' 
                        w='100%' 
                        h='60px' 
                        borderRadius='16px' 
                        fontWeight='900'
                        onClick={handleEnable}
                    >
                        ENABLE NOTIFICATIONS
                    </Button>
                )}
            </Flex>
        </Box>
    );
};

export default ForceNotifModal;
