import { HStack } from '@chakra-ui/react';
import AnimatedNumber from './AnimatedNumber';

const BalanceBadge = ({ balance, size = 'md' }: { balance: number; size?: 'sm' | 'md' | 'lg' }) => {
	const sizes = {
		sm: { fontSize: 'xs', px: 2, py: 1 },
		md: { fontSize: 'sm', px: 3, py: '6px' },
		lg: { fontSize: 'lg', px: 4, py: 2 },
	};
	const s = sizes[size];

	return (
		<HStack
			bg='rgba(255,191,0,0.1)'
			border='1px solid'
			borderColor='brand.500'
			borderRadius='8px'
			px={s.px}
			py={s.py}
			spacing={1}
			color='brand.500'
			fontSize={s.fontSize}
		>
			<AnimatedNumber value={balance} />
			<span style={{ fontFamily: 'Inter Tight', fontWeight: 600 }}>BT</span>
		</HStack>
	);
};

export default BalanceBadge;
