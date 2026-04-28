import { Box, Heading, Text, SimpleGrid } from '@chakra-ui/react';
import { usePerks } from '@/hooks/usePerks';
import PerkCard from '@/components/PerkCard';

const PerksPage = () => {
	const perks = usePerks();

	return (
		<Box p={8} maxW='800px'>
			<Box mb={6}>
				<Heading size='lg' color='textPrimary' fontWeight='700'>
					Perks
				</Heading>
				<Text color='textSecondary' fontSize='sm' mt={1}>
					Spend your beer tabs on house perks
				</Text>
			</Box>

			{perks.length === 0 ? (
				<Box bg='surface' borderRadius='14px' border='1px solid' borderColor='border' p={8} textAlign='center'>
					<Text color='textSecondary'>
						No perks available yet.
					</Text>
				</Box>
			) : (
				<SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
					{perks.map((p) => <PerkCard key={p.id} perk={p} />)}
				</SimpleGrid>
			)}
		</Box>
	);
};

export default PerksPage;
