import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BiometricService } from '../../services/BiometricService';

interface BiometricAuthProps {
  onSuccess: () => void;
  onFailure: (error: string) => void;
  onSkip?: () => void;
  title?: string;
  subtitle?: string;
  allowSkip?: boolean;
  retryCount?: number;
}

const { width, height } = Dimensions.get('window');

export const BiometricAuth: React.FC<BiometricAuthProps> = ({
  onSuccess,
  onFailure,
  onSkip,
  title = 'Authenticate to Continue',
  subtitle = 'Use your biometric to securely access your account',
  allowSkip = true,
  retryCount = 3,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [availableBiometrics, setAvailableBiometrics] = useState<string[]>([]);
  const [selectedBiometric, setSelectedBiometric] = useState<string>('');
  const [attempts, setAttempts] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [error, setError] = useState<string>('');

  const biometricService = new BiometricService();

  useEffect(() => {
    checkBiometricAvailability();
    animateEntrance();
  }, []);

  useEffect(() => {
    // Pulse animation for biometric icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const animateEntrance = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const checkBiometricAvailability = async () => {
    try {
      const biometrics = await biometricService.getAvailableBiometrics();
      setAvailableBiometrics(biometrics);
      
      if (biometrics.length > 0) {
        // Auto-select the most secure biometric
        const priorityOrder = ['Face ID', 'Touch ID', 'Fingerprint', 'Iris', 'Voice'];
        for (const biometric of priorityOrder) {
          if (biometrics.includes(biometric)) {
            setSelectedBiometric(biometric);
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setError('Unable to check biometric availability');
    }
  };

  const authenticate = async (biometricType: string) => {
    if (attempts >= retryCount) {
      onFailure('Maximum authentication attempts exceeded');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await biometricService.authenticate(biometricType, {
        title,
        subtitle,
        description: 'Verify your identity to continue',
        fallbackTitle: 'Use Passcode',
        cancelTitle: 'Cancel',
      });

      if (result.success) {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onSuccess();
        });
      } else {
        setAttempts(attempts + 1);
        setError(result.error || 'Authentication failed');
        
        // Shake animation on error
        shakeAnimation();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setAttempts(attempts + 1);
      setError(errorMessage);
      shakeAnimation();
    } finally {
      setIsLoading(false);
    }
  };

  const shakeAnimation = () => {
    const shake = Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]);
    shake.start();
  };

  const getBiometricIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'face id':
      case 'face':
        return 'face';
      case 'touch id':
      case 'fingerprint':
        return 'fingerprint';
      case 'iris':
        return 'visibility';
      case 'voice':
        return 'mic';
      default:
        return 'security';
    }
  };

  const getBiometricColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'face id':
      case 'face':
        return '#FF6B6B';
      case 'touch id':
      case 'fingerprint':
        return '#4ECDC4';
      case 'iris':
        return '#45B7D1';
      case 'voice':
        return '#96CEB4';
      default:
        return '#6C5CE7';
    }
  };

  const renderBiometricOption = (biometric: string) => {
    const isSelected = selectedBiometric === biometric;
    const icon = getBiometricIcon(biometric);
    const color = getBiometricColor(biometric);

    return (
      <TouchableOpacity
        key={biometric}
        style={[
          styles.biometricOption,
          isSelected && { backgroundColor: color, borderColor: color },
        ]}
        onPress={() => setSelectedBiometric(biometric)}
        disabled={isLoading}
      >
        <Icon
          name={icon}
          size={32}
          color={isSelected ? '#FFFFFF' : color}
        />
        <Text style={[styles.biometricText, isSelected && { color: '#FFFFFF' }]}>
          {biometric}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <Animated.View style={[styles.errorContainer, { opacity: fadeAnim }]}>
        <Icon name="error" size={20} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
      </Animated.View>
    );
  };

  const renderAttempts = () => {
    if (attempts === 0) return null;

    return (
      <Text style={styles.attemptsText}>
        Attempts remaining: {retryCount - attempts}
      </Text>
    );
  };

  if (availableBiometrics.length === 0) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Icon name="security" size={64} color="#6C5CE7" />
          <Text style={styles.title}>No Biometric Available</Text>
          <Text style={styles.subtitle}>
            Your device doesn't support biometric authentication. Please use your passcode.
          </Text>
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Use Passcode</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.biometricContainer}>
          <Animated.View
            style={[
              styles.selectedBiometric,
              {
                transform: [{ scale: pulseAnim }],
                borderColor: getBiometricColor(selectedBiometric),
              },
            ]}
          >
            <Icon
              name={getBiometricIcon(selectedBiometric)}
              size={64}
              color={getBiometricColor(selectedBiometric)}
            />
          </Animated.View>

          {availableBiometrics.length > 1 && (
            <View style={styles.biometricOptions}>
              {availableBiometrics.map(renderBiometricOption)}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.authenticateButton,
            { backgroundColor: getBiometricColor(selectedBiometric) },
            isLoading && styles.disabledButton,
          ]}
          onPress={() => authenticate(selectedBiometric)}
          disabled={isLoading || !selectedBiometric}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Icon name="lock" size={20} color="#FFFFFF" />
              <Text style={styles.authenticateButtonText}>
                Authenticate with {selectedBiometric}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {renderError()}
        {renderAttempts()}

        {allowSkip && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: width * 0.9,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 22,
  },
  biometricContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  selectedBiometric: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  biometricOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  biometricOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  biometricText: {
    fontSize: 12,
    color: '#2C3E50',
    marginTop: 4,
    fontWeight: '500',
  },
  authenticateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginBottom: 20,
    gap: 8,
  },
  authenticateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  attemptsText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 16,
  },
  skipButton: {
    padding: 12,
  },
  skipButtonText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '500',
  },
});
