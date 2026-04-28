import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Box } from '@chakra-ui/react';

interface Props {
	fire: boolean;
	colors?: string[];
}

const Confetti = ({ fire, colors = ['#FFBF00', '#00C853', '#FFFFFF', '#007AFF'] }: Props) => {
	const [pieces, setPieces] = useState<any[]>([]);

	useEffect(() => {
		if (fire) {
			const arr = Array.from({ length: 40 }).map((_, i) => ({
				id: i,
				x: Math.random() * 100 - 50, // -50vw to +50vw target
				y: -(Math.random() * 100 + 50), // shoot upwards 50-150vh
				rotation: Math.random() * 360,
				scale: Math.random() * 0.5 + 0.5,
				color: colors[Math.floor(Math.random() * colors.length)]
			}));
			setPieces(arr);

			// Clear after drop
			const t = setTimeout(() => setPieces([]), 4000);
			return () => clearTimeout(t);
		}
	}, [fire]);

	if (!fire || pieces.length === 0) return null;

	return (
		<Box position='fixed' top='50%' left='50%' zIndex={9999} pointerEvents='none'>
			{pieces.map((p) => (
				<motion.div
					key={p.id}
					initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0 }}
					animate={{ 
						x: `${p.x}vw`, 
						y: [`0vh`, `${p.y}vh`, `${p.y + 100}vh`],
						rotate: p.rotation + 360,
						opacity: [1, 1, 0],
						scale: p.scale
					}}
					transition={{ duration: 2.5, ease: 'easeOut', times: [0, 0.2, 1] }}
					style={{
						position: 'absolute',
						width: '12px',
						height: '12px',
						backgroundColor: p.color,
						borderRadius: p.id % 2 === 0 ? '50%' : '2px',
					}}
				/>
			))}
		</Box>
	);
};

export default Confetti;
