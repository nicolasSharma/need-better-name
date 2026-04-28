import { Navigate } from 'react-router-dom';
import { Center, Spinner } from '@chakra-ui/react';
import { useAuth } from '@/hooks/useAuth';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
	const { user, loading } = useAuth();

	if (loading) return (
		<Center h='100vh' bg='bg'>
			<Spinner size='xl' color='primaryAction' thickness='3px' />
		</Center>
	);

	if (!user) return <Navigate to='/login' replace />;
	return <>{children}</>;
};

export default ProtectedRoute;
