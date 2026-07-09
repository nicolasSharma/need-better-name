import { Box, Text, VStack, Icon, keyframes } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const float = keyframes`
	0%, 100% { transform: translateY(0); }
	50% { transform: translateY(-8px); }
`;

interface EmptyStateProps {
	icon: any;
	title: string;
	subtitle: string;
	action?: React.ReactNode;
}

const EmptyState = ({ icon, title, subtitle, action }: EmptyStateProps) => {
	return (
		<Box
			as={motion.div}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4 } as any}
			bg='surface'
			borderRadius='24px'
			border='1px solid'
			borderColor='border'
			p={10}
			textAlign='center'
		>
			<VStack spacing={4}>
				<Box animation={`${float} 3s ease-in-out infinite`}>
					<Icon as={icon} boxSize={14} color='primaryAction' opacity={0.4} />
				</Box>
				<Text color='textPrimary' fontWeight='800' fontSize='lg'>
					{title}
				</Text>
				<Text color='textSecondary' fontSize='sm' maxW='260px' lineHeight='1.5'>
					{subtitle}
				</Text>
				{action}
			</VStack>
		</Box>
	);
};

export default EmptyState;
