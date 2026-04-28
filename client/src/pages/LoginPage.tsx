import { useState } from 'react';
import { Box, Center, Heading, Text, Input, Button, VStack, useToast, Flex } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { logIn } from '@/lib/firestore';

const LoginPage = () => {
	const [name, setName] = useState(() => localStorage.getItem('lastUser') || '');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const toast = useToast();
	const navigate = useNavigate();

	const handleLogin = async () => {
		if (!name || !password) return;
		setLoading(true);
		try {
			await logIn(name, password);
			localStorage.setItem('lastUser', name);
			navigate('/');
		} catch {
			toast({ title: 'Login failed', description: 'Invalid name or password.', status: 'error', duration: 3000 });
		}
		setLoading(false);
	};

	return (
		<Center minH='100vh' bg='bg'>
			<Box maxW='400px' w='full' px={6}>
				<VStack spacing={8} align='stretch'>
					<Box textAlign='center'>
						<Heading size='2xl' fontWeight='900' color='textPrimary' letterSpacing='tight'>
							THE HUB
						</Heading>
					</Box>

					<VStack spacing={4}>
						<Input
							placeholder='Your name'
							value={name}
							onChange={(e) => setName(e.target.value)}
							size='lg'
							bg='surface'
						/>
						<Input
							placeholder='Password'
							type='password'
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
							size='lg'
							bg='surface'
						/>
					</VStack>

					<Button 
						variant='primary' 
						onClick={handleLogin} 
						isLoading={loading} 
						h='60px' 
						fontSize='md'
						fontWeight='800'
					>
						Log In
					</Button>

					<Flex justify='center'>
						<Text fontSize='sm' color='textSecondary' fontWeight='700'>
							New here?{' '}
							<Text
								as='span'
								color='primaryAction'
								cursor='pointer'
								fontWeight='800'
								_hover={{ textDecoration: 'underline' }}
								onClick={() => navigate('/signup')}
							>
								Create Account
							</Text>
						</Text>
					</Flex>
				</VStack>
			</Box>
		</Center>
	);
};

export default LoginPage;
