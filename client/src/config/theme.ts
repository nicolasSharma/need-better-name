import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import '@/config/fonts.css';

const config: ThemeConfig = {
	initialColorMode: 'light',
	useSystemColorMode: true, 
};

const theme = extendTheme({
	config,
	semanticTokens: {
		colors: {
			bg: {
				default: '#FFFFFF',
				_dark: '#000000',
			},
			surface: {
				default: '#F2F2F7', 
				_dark: '#1C1C1E',  
			},
			surfaceDeep: {
				default: '#FFFFFF',
				_dark: '#161B22',
			},
			border: {
				default: '#E5E5EA',
				_dark: '#38383A',
			},
			textPrimary: {
				default: '#000000',
				_dark: '#FFFFFF',
			},
			textSecondary: {
				default: '#8E8E93',
				_dark: '#8E8E93',
			},
			primaryAction: {
				default: '#007AFF',
				_dark: '#0A84FF',
			},
			yesAction: {
				default: '#34C759', 
				_dark: '#30D158',
			},
			noAction: {
				default: '#FF3B30', 
				_dark: '#FF453A',
			},
			yesBg: {
				default: 'rgba(52, 199, 89, 0.1)',
				_dark: 'rgba(48, 209, 88, 0.15)',
			},
			noBg: {
				default: 'rgba(255, 59, 48, 0.1)',
				_dark: 'rgba(255, 69, 58, 0.15)',
			},
		},
	},
	styles: {
		global: {
			'html, body': {
				bg: 'bg',
				color: 'textPrimary',
				transition: 'background 0.2s ease, color 0.2s ease',
				paddingTop: 'env(safe-area-inset-top, 0px)',
				paddingBottom: 'env(safe-area-inset-bottom, 0px)',
			},
		},
	},
	components: {
		Button: {
			baseStyle: {
				borderRadius: '12px',
				fontWeight: '700',
				_active: { transform: 'scale(0.95)' },
			},
			variants: {
				primary: {
					bg: 'primaryAction',
					color: 'white',
					_active: { filter: 'brightness(90%)' },
				},
				surface: {
					bg: 'surface',
					color: 'textPrimary',
					border: '1px solid',
					borderColor: 'border',
					_hover: { bg: 'border' },
				},
				green: {
					bg: 'yesAction',
					color: 'white',
				},
				red: {
					bg: 'noAction',
					color: 'white',
				},
				gold: {
					bg: 'primaryAction',
					color: 'white',
				},
				ghost: {
					color: 'textSecondary',
					_hover: { color: 'textPrimary', bg: 'transparent' },
				},
			},
		},
		Input: {
			variants: {
				filled: {
					field: {
						bg: 'surface',
						borderRadius: '12px',
						color: 'textPrimary',
						border: '1px solid',
						borderColor: 'border',
						_focus: { bg: 'bg', borderColor: 'primaryAction' },
					},
				},
			},
			defaultProps: { variant: 'filled' },
		},
	},
});

export default theme;
