import { Box, keyframes } from '@chakra-ui/react';

const pulse = keyframes`
  0% { opacity: 0.3; }
  50% { opacity: 0.1; }
  100% { opacity: 0.3; }
`;

interface SkeletonProps {
	w?: string | number;
	h?: string | number;
	borderRadius?: string;
	mt?: number | string;
	mb?: number | string;
	flex?: number;
}

const Skeleton = ({ w = '100%', h = '20px', borderRadius = '8px', mt, mb, flex }: SkeletonProps) => {
	const animation = `${pulse} 1.5s ease-in-out infinite`;

	return (
		<Box 
			w={w} 
			h={h} 
			bg='border' 
			borderRadius={borderRadius} 
			animation={animation} 
			mt={mt} 
			mb={mb} 
			flex={flex}
		/>
	);
};

export default Skeleton;
