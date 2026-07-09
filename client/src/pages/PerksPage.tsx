import { Box, Heading, Text, SimpleGrid, Icon, VStack } from '@chakra-ui/react';
import { usePerks } from '@/hooks/usePerks';
import PerkCard from '@/components/PerkCard';
import Skeleton from '@/components/Skeleton';
import { IoGiftOutline } from 'react-icons/io5';

const PerksPage = () => {
	const perks = usePerks();

	return (
		<Box px={4} py={6} pb={24} maxW='600px' mx='auto'>
			<Box mb={8}>
				<Text fontSize='2xl' fontWeight='900' color='textPrimary' fontFamily='Hellix'>
					Perks Store
				</Text>
				<Text color='textSecondary' fontSize='sm' mt={1}>
					Spend your BT on house privileges and rewards.
				</Text>
			</Box>

			{perks === undefined ? (
				<VStack spacing={4}>
					<Skeleton h='100px' borderRadius='16px' />
					<Skeleton h='100px' borderRadius='16px' />
					<Skeleton h='100px' borderRadius='16px' />
				</VStack>
			) : perks.length === 0 ? (
				<Box bg='surface' borderRadius='24px' border='1px solid' borderColor='border' p={12} textAlign='center'>
					<VStack spacing={4}>
						<Icon as={IoGiftOutline} boxSize={12} color='textSecondary' opacity={0.2} />
						<Text color='textPrimary' fontWeight='700' fontSize='lg'>
							No perks available yet
						</Text>
						<Text color='textSecondary' fontSize='sm'>
							The house admin hasn't posted any perks. Check back soon!
						</Text>
					</VStack>
				</Box>
			) : (
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
					{perks.map((p) => <PerkCard key={p.id} perk={p} />)}
				</SimpleGrid>
			)}
		</Box>
	);
};

export default PerksPage;
