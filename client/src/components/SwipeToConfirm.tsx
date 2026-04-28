import { useState, useRef, useEffect } from 'react';
import { Box, Flex, Text, useTheme } from '@chakra-ui/react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { IoChevronForward } from 'react-icons/io5';
import { triggerHaptic } from '@/lib/haptics';
import { playPlink } from '@/lib/audio';

interface Props {
	onConfirm: () => void;
	isLoading: boolean;
	trackColor?: string;
}

const SwipeToConfirm = ({ onConfirm, isLoading, trackColor = 'primaryAction' }: Props) => {
	const [confirmed, setConfirmed] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const controls = useAnimation();
	const x = useMotionValue(0);

	// Reset if loading finishes (e.g. error, or drawer closes)
	useEffect(() => {
		if (!isLoading && confirmed) {
			setConfirmed(false);
			controls.start({ x: 0 });
		}
	}, [isLoading]);

	// Fade out text as we swipe
	const textOpacity = useTransform(x, [0, 150], [1, 0]);

	const handleDragEnd = (event: any, info: any) => {
		if (confirmed) return;

		const containerWidth = containerRef.current?.offsetWidth || 300;
		const thumbWidth = 60; // Hardcoded thumb width
		const threshold = containerWidth - thumbWidth - 10;

		if (info.offset.x >= threshold) {
			setConfirmed(true);
			triggerHaptic();
			controls.start({ x: containerWidth - thumbWidth - 4 }); // Lock at the end
			onConfirm();
		} else {
			// Snap back
			playPlink();
			controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } });
		}
	};

	return (
		<Box 
			ref={containerRef} 
			bg='surfaceDeep' 
			h='60px' 
			borderRadius='16px' 
			position='relative' 
			overflow='hidden' 
			border='1px solid' 
			borderColor='border'
			opacity={isLoading ? 0.7 : 1}
			pointerEvents={isLoading ? 'none' : 'auto'}
		>
			{/* Filled background expanding behind the thumb */}
			<motion.div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					bottom: 0,
					width: useTransform(x, (val) => val + 60),
					background: `var(--chakra-colors-${trackColor})`,
					opacity: 0.15,
				}}
			/>

			{/* The Thumb */}
			<motion.div
				drag='x'
				dragConstraints={containerRef}
				dragElastic={0.05}
				dragMomentum={false}
				onDragEnd={handleDragEnd}
				animate={controls}
				style={{ x, position: 'absolute', top: '4px', left: '4px', zIndex: 2 }}
			>
				<Flex 
					w='52px' 
					h='50px' 
					bg={trackColor} 
					borderRadius='12px' 
					align='center' 
					justify='center' 
					color='white'
					boxShadow='0 2px 8px rgba(0,0,0,0.2)'
					cursor='grab'
					_active={{ cursor: 'grabbing', transform: 'scale(0.95)' }}
				>
					{isLoading ? (
						<motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
					) : (
						<IoChevronForward size={24} />
					)}
				</Flex>
			</motion.div>

			{/* Text */}
			<Flex align='center' justify='center' h='100%' w='100%' pointerEvents='none'>
				<motion.div style={{ opacity: textOpacity }}>
					<Text color='textSecondary' fontWeight='600' fontSize='sm' letterSpacing='widest' textTransform='uppercase' ml={8}>
						{isLoading ? 'Processing...' : 'Swipe to Confirm'}
					</Text>
				</motion.div>
			</Flex>
		</Box>
	);
};

export default SwipeToConfirm;
