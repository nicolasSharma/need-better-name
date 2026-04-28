import { Box, Flex, Text, Button, useToast } from '@chakra-ui/react';
import { Perk } from '@/hooks/usePerks';
import { buyPerk } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

const PerkCard = ({ perk }: { perk: Perk }) => {
	const { user } = useAuth();
	const { profile } = useUser();
	const toast = useToast();
	const canAfford = (profile?.balance || 0) >= perk.cost;

	const handleBuy = async () => {
		if (!user) return;
		try {
			await buyPerk(perk.id, user.uid);
			toast({ title: `${perk.name} acquired!`, status: 'success', duration: 3000 });
		} catch (e: any) {
			toast({ title: 'Error', description: e.message, status: 'error' });
		}
	};

	return (
		<Box
			bg='surface.100'
			border='1px solid'
			borderColor='whiteAlpha.100'
			borderRadius='14px'
			p={4}
			transition='all 0.2s'
			_hover={{ borderColor: 'whiteAlpha.200' }}
		>
			<Flex align='center' gap={3} mb={2}>
				<Box>
					<Text fontFamily='Hellix' fontWeight='600' color='white' fontSize='md'>
						{perk.name}
					</Text>
					<Text fontSize='xs' color='whiteAlpha.500' fontFamily='Hubot'>
						{perk.description}
					</Text>
				</Box>
			</Flex>
			<Flex justify='space-between' align='center'>
				<Text color='brand.400' fontFamily='Hellix' fontWeight='700' fontSize='sm'>
					{perk.cost} BT
				</Text>
				<Button
					size='sm'
					variant={canAfford ? 'gold' : 'outline'}
					isDisabled={!canAfford}
					onClick={handleBuy}
					borderRadius='8px'
				>
					{canAfford ? 'Buy' : "Can't afford"}
				</Button>
			</Flex>
		</Box>
	);
};

export default PerkCard;
