import { Box, Flex, Text, Button, useToast, Icon } from '@chakra-ui/react';
import type { Perk } from '@/types';
import { buyPerk } from '@/lib/services';
import { useAuth } from '@/context/AuthProvider';
import { useUser } from '@/context/AppDataProvider';
import { IoCartOutline, IoLockClosedOutline } from 'react-icons/io5';
import { triggerHaptic } from '@/lib/haptics';

const PerkCard = ({ perk }: { perk: Perk }) => {
	const { user } = useAuth();
	const { profile } = useUser();
	const toast = useToast();
	const canAfford = (profile?.balance || 0) >= perk.cost;

	const handleBuy = async () => {
		if (!user) return;
		triggerHaptic();
		try {
			await buyPerk(perk.id, user.uid);
			toast({ title: `${perk.name} acquired!`, status: 'success', duration: 3000 });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	return (
		<Box
			bg='surface'
			border='1px solid'
			borderColor={canAfford ? 'primaryAction' : 'border'}
			borderRadius='20px'
			p={5}
			transition='all 0.2s'
			_hover={{ borderColor: canAfford ? 'primaryAction' : 'border', transform: 'translateY(-2px)', boxShadow: 'lg' }}
			opacity={canAfford ? 1 : 0.6}
		>
			<Flex align='start' justify='space-between' mb={3}>
				<Box flex={1}>
					<Text fontWeight='800' color='textPrimary' fontSize='md'>
						{perk.name}
					</Text>
					<Text fontSize='xs' color='textSecondary' mt={0.5} lineHeight='1.4'>
						{perk.description}
					</Text>
				</Box>
			</Flex>
			<Flex justify='space-between' align='center'>
				<Text color='primaryAction' fontWeight='900' fontSize='lg' fontFamily='JetBrains Mono'>
					{perk.cost} BT
				</Text>
				<Button
					size='sm'
					bg={canAfford ? 'primaryAction' : 'surfaceDeep'}
					color={canAfford ? 'white' : 'textSecondary'}
					isDisabled={!canAfford}
					onClick={handleBuy}
					borderRadius='12px'
					fontWeight='800'
					px={5}
					leftIcon={<Icon as={canAfford ? IoCartOutline : IoLockClosedOutline} />}
					_hover={canAfford ? { opacity: 0.9 } : {}}
					_active={canAfford ? { transform: 'scale(0.95)' } : {}}
				>
					{canAfford ? 'Buy' : "Can't afford"}
				</Button>
			</Flex>
		</Box>
	);
};

export default PerkCard;
