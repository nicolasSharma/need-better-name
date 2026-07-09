import { useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface Props {
	onRefresh?: () => Promise<void> | void;
	children: ReactNode;
}

const THRESHOLD = 80;
const MAX_PULL = 120;
const SLOT_ICONS = ['🍒', '🍋', '🔔', '💎', '7️⃣'];

const PullToRefresh = ({ onRefresh, children }: Props) => {
	const [refreshing, setRefreshing] = useState(false);
	const [slots, setSlots] = useState(['🎰', '🎰', '🎰']);
	const pullY = useMotionValue(0);
	const touchStartY = useRef(0);
	const pulling = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const indicatorOpacity = useTransform(pullY, [0, 40, THRESHOLD], [0, 0.5, 1]);
	const indicatorScale = useTransform(pullY, [0, THRESHOLD], [0.5, 1]);
	const indicatorRotate = useTransform(pullY, [0, MAX_PULL], [0, 360]);

	useEffect(() => {
		let interval: any;
		if (refreshing) {
			interval = setInterval(() => {
				setSlots([
					SLOT_ICONS[Math.floor(Math.random() * SLOT_ICONS.length)],
					SLOT_ICONS[Math.floor(Math.random() * SLOT_ICONS.length)],
					SLOT_ICONS[Math.floor(Math.random() * SLOT_ICONS.length)]
				]);
			}, 100);
		} else {
			setSlots(['💰', '💰', '💰']);
		}
		return () => clearInterval(interval);
	}, [refreshing]);

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		// Only start pulling if we're scrolled to the top
		const scrollTop = containerRef.current?.closest('[data-scroll-root]')?.scrollTop 
			?? document.getElementById('root')?.scrollTop 
			?? 0;
		if (scrollTop <= 0 && !refreshing) {
			touchStartY.current = e.touches[0].clientY;
			pulling.current = true;
		}
	}, [refreshing]);

	const handleTouchMove = useCallback((e: React.TouchEvent) => {
		if (!pulling.current || refreshing) return;
		const diff = e.touches[0].clientY - touchStartY.current;
		if (diff > 0) {
			// Apply resistance curve
			const dampened = Math.min(MAX_PULL, diff * 0.5);
			pullY.set(dampened);
		} else {
			pulling.current = false;
			pullY.set(0);
		}
	}, [refreshing, pullY]);

	const handleTouchEnd = useCallback(async () => {
		if (!pulling.current) return;
		pulling.current = false;

		if (pullY.get() >= THRESHOLD && onRefresh) {
			setRefreshing(true);
			animate(pullY, 60, { duration: 0.2 });
			try {
				await onRefresh();
			} catch (e) {
				console.error('Refresh error:', e);
			}
			// Hold spinner for a beat so it feels real
			await new Promise(r => setTimeout(r, 600));
			setRefreshing(false);
		}
		animate(pullY, 0, { duration: 0.3, type: 'spring', stiffness: 300, damping: 30 });
	}, [pullY, onRefresh]);

	return (
		<Box
			ref={containerRef}
			position='relative'
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			{/* Pull indicator */}
			<Flex
				as={motion.div}
				style={{ opacity: indicatorOpacity, scale: indicatorScale, y: pullY }}
				position='absolute'
				top='-50px'
				left='50%'
				transform='translateX(-50%)'
				zIndex={50}
				align='center'
				justify='center'
				w='100px'
				h='40px'
				borderRadius='full'
				bg='surfaceDeep'
				border='2px solid'
				borderColor='border'
				shadow='0 8px 32px rgba(0,0,0,0.1)'
			>
				{refreshing ? (
					<Text fontSize='lg' letterSpacing='2px' lineHeight='1'>{slots.join('')}</Text>
				) : (
					<motion.div style={{ rotate: indicatorRotate }}>
						<Text fontSize='xl' lineHeight='1'>🎰</Text>
					</motion.div>
				)}
			</Flex>

			{/* Content with pull offset */}
			<motion.div style={{ y: pullY }}>
				{children}
			</motion.div>
		</Box>
	);
};

export default PullToRefresh;
