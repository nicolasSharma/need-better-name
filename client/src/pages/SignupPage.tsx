import { useState } from 'react';
import { Box, Center, Heading, Text, Input, Button, VStack, useToast, Flex } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { signUp } from '@/lib/firestore';

const SignupPage = () => {
	const [name, setName] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const toast = useToast();
	const navigate = useNavigate();

	const handleSignup = async () => {
		if (!name || !password) return;
		if (password.length < 6) {
			toast({ title: 'Security Requirement', description: 'Minimum 6 character requirement.', status: 'warning' });
			return;
		}
		setLoading(true);
		try {
			await signUp(name, password);
			localStorage.setItem('lastUser', name);
			toast({ title: `Handshake Complete`, description: `Welcome, ${name}.`, status: 'success', duration: 3000 });
			navigate('/');
		} catch (e: any) {
			const msg = e.code === 'auth/email-already-in-use' ? 'That entity identity is already taken.' : e.message;
			toast({ title: 'Protocol Failure', description: msg, status: 'error' });
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
							placeholder='Create a password'
							type='password'
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
							size='lg'
							bg='surface'
						/>
					</VStack>

					<Button 
						variant='primary' 
						onClick={handleSignup} 
						isLoading={loading} 
						h='60px' 
						fontSize='md'
						fontWeight='800'
					>
						Register Entity
					</Button>

					<Flex justify='center'>
						<Text fontSize='sm' color='textSecondary' fontWeight='700'>
							Already registered?{' '}
							<Text
								as='span'
								color='primaryAction'
								cursor='pointer'
								fontWeight='800'
								_hover={{ textDecoration: 'underline' }}
								onClick={() => navigate('/login')}
							>
								Log In
							</Text>
						</Text>
					</Flex>
				</VStack>
			</Box>
		</Center>
	);
};

export default SignupPage;
