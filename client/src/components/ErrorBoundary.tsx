import { Component, type ReactNode } from 'react';
import { Box, VStack, Text, Button, Icon } from '@chakra-ui/react';
import { IoWarningOutline, IoRefreshOutline } from 'react-icons/io5';

interface Props {
	children: ReactNode;
	fallbackTitle?: string;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: any) {
		console.error('[ErrorBoundary]', error, info?.componentStack);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			return (
				<Box p={8} maxW='500px' mx='auto' mt={12}>
					<Box
						bg='surface'
						borderRadius='24px'
						border='1px solid'
						borderColor='border'
						p={8}
						textAlign='center'
					>
						<VStack spacing={5}>
							<Icon as={IoWarningOutline} boxSize={12} color='noAction' opacity={0.6} />
							<Box>
								<Text fontSize='lg' fontWeight='900' color='textPrimary' mb={1}>
									{this.props.fallbackTitle || 'Something went wrong'}
								</Text>
								<Text fontSize='sm' color='textSecondary' fontWeight='600'>
									{this.state.error?.message || 'An unexpected error occurred.'}
								</Text>
							</Box>
							<Button
								leftIcon={<Icon as={IoRefreshOutline} />}
								variant='surface'
								onClick={this.handleReset}
								fontWeight='800'
								borderRadius='16px'
								h='48px'
								px={8}
							>
								Try Again
							</Button>
							<Button
								variant='ghost'
								size='sm'
								color='textSecondary'
								onClick={() => window.location.reload()}
								fontWeight='700'
							>
								Reload App
							</Button>
						</VStack>
					</Box>
				</Box>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
