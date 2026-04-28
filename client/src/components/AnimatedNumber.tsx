import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flex } from '@chakra-ui/react';

interface Props {
	value: number;
}

const AnimatedNumber = ({ value }: Props) => {
	const [prevValue, setPrevValue] = useState(value);
	const direction = value > prevValue ? 1 : -1;

	useEffect(() => {
		if (value !== prevValue) {
			setPrevValue(value);
		}
	}, [value]);

	const str = value.toLocaleString();
	const chars = str.split('');

	return (
		<Flex overflow='hidden' position='relative' display='inline-flex' fontWeight='800' fontFamily="'JetBrains Mono', monospace">
			{chars.map((char, index) => {
				// We base the key on the index from the END of the string so commas/digits don't jump indices when it grows (e.g. 99 -> 100)
				const reverseIndex = chars.length - index;
				
				// Commas don't need to animate up/down
				if (isNaN(parseInt(char))) {
					return <span key={`char-${reverseIndex}`}>{char}</span>;
				}

				return (
					<motion.span
						key={`col-${reverseIndex}`}
						style={{ position: 'relative', display: 'inline-flex', overflow: 'hidden' }}
					>
						<AnimatePresence mode='popLayout' initial={false}>
							<motion.span
								key={char}
								initial={{ y: direction * 20, opacity: 0 }}
								animate={{ y: 0, opacity: 1 }}
								exit={{ y: direction * -20, opacity: 0 }}
								transition={{ type: 'spring', stiffness: 300, damping: 25 }}
								style={{ display: 'inline-block' }}
							>
								{char}
							</motion.span>
						</AnimatePresence>
					</motion.span>
				);
			})}
		</Flex>
	);
};

export default AnimatedNumber;
