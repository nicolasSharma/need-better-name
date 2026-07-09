import { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

export const triggerCoinDrop = (amount: number = 10) => {
	window.dispatchEvent(new CustomEvent('coin-drop', { detail: { amount } }));
};

const CoinDrop = () => {
	const [coins, setCoins] = useState<{ id: string, x: number, delay: number, size: number }[]>([]);

	useEffect(() => {
		const handleEvent = (e: any) => {
			const amt = Math.min(e.detail.amount || 15, 30); // Cap coins for performance
			const newCoins = Array.from({ length: amt }).map(() => ({
				id: Math.random().toString(),
				x: Math.random() * (window.innerWidth - 40), // Spread across screen
				delay: Math.random() * 0.4, // Staggered drop
				size: Math.random() * 10 + 20 // Random sizes between 20px and 30px
			}));
			
			// Append instead of replace so multiple triggers stack
			setCoins(prev => [...prev, ...newCoins]);
			
			// Clean up after animation finishes
			setTimeout(() => {
				setCoins(prev => prev.filter(c => !newCoins.find(nc => nc.id === c.id)));
			}, 3000);
		};

		window.addEventListener('coin-drop', handleEvent);
		return () => window.removeEventListener('coin-drop', handleEvent);
	}, []);

	return (
		<Box position='fixed' top={0} left={0} right={0} bottom={0} pointerEvents='none' zIndex={9999} overflow='hidden'>
			<AnimatePresence>
				{coins.map((coin) => (
					<Box
						key={coin.id}
						as={motion.div}
						position='absolute'
						top='-50px'
						left={`${coin.x}px`}
						initial={{ y: -50, opacity: 1, rotateY: 0, rotateZ: Math.random() * 45 }}
						animate={{ 
							y: window.innerHeight + 100, 
							rotateY: 360 * 3, // Spinning coin effect
							rotateZ: (Math.random() - 0.5) * 90
						}}
						exit={{ opacity: 0 }}
						transition={{ 
							duration: 1.2 + Math.random() * 0.5, 
							delay: coin.delay, 
							ease: [0.4, 0, 1, 1] // Gravity curve
						}}
						fontSize={`${coin.size}px`}
						filter='drop-shadow(0px 8px 12px rgba(0,0,0,0.4))'
						lineHeight='1'
					>
						💰
					</Box>
				))}
			</AnimatePresence>
		</Box>
	);
};

export default CoinDrop;
