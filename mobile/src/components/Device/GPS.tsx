import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Geolocation from '@react-native-community/geolocation';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  useSignificantChanges?: boolean;
}

export interface LocationResult {
  success: boolean;
  location?: LocationData;
  error?: string;
  permissionDenied?: boolean;
}

export interface LocationTracking {
  isActive: boolean;
  isTracking: boolean;
  currentLocation?: LocationData;
  trackingHistory: LocationData[];
  accuracy: number;
  lastUpdate: number;
}

interface LocationContextType {
  location: LocationData | null;
  tracking: LocationTracking;
  getCurrentLocation: (options?: LocationOptions) => Promise<LocationResult>;
  startLocationTracking: (options?: LocationOptions) => Promise<LocationResult>;
  stopLocationTracking: () => void;
  requestLocationPermission: () => Promise<boolean>;
  hasLocationPermission: () => Promise<boolean>;
  calculateDistance: (from: LocationData, to: LocationData) => number;
  isWithinRadius: (center: LocationData, point: LocationData, radius: number) => boolean;
}

const LocationContext = createContext<LocationContextType | null>(null);

interface LocationProviderProps {
  children: ReactNode;
  onLocationUpdate?: (location: LocationData) => void;
  onLocationError?: (error: string) => void;
  defaultOptions?: LocationOptions;
}

const { width, height } = Dimensions.get('window');

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
  onLocationUpdate,
  onLocationError,
  defaultOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
    distanceFilter: 10,
  },
}) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [tracking, setTracking] = useState<LocationTracking>({
    isActive: false,
    isTracking: false,
    trackingHistory: [],
    accuracy: 0,
    lastUpdate: 0,
  });
  const [watchId, setWatchId] = useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    checkLocationPermission();
    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const checkLocationPermission = async () => {
    const hasPermission = await hasLocationPermission();
    setPermissionGranted(hasPermission);
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        setPermissionGranted(granted === PermissionsAndroid.RESULTS.GRANTED);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // iOS permissions are handled by the system
        setPermissionGranted(true);
        return true;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setPermissionGranted(false);
      return false;
    }
  };

  const hasLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted;
      } else {
        // iOS - check authorization status
        return true; // Simplified for now
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  };

  const getCurrentLocation = async (options?: LocationOptions): Promise<LocationResult> => {
    const mergedOptions = { ...defaultOptions, ...options };

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy || 0,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp || Date.now(),
          };

          setLocation(locationData);
          setTracking(prev => ({
            ...prev,
            currentLocation: locationData,
            lastUpdate: Date.now(),
            accuracy: locationData.accuracy || 0,
          }));

          if (onLocationUpdate) {
            onLocationUpdate(locationData);
          }

          resolve({
            success: true,
            location: locationData,
          });
        },
        (error) => {
          let errorMessage = 'Unknown error occurred';
          let permissionDenied = false;

          switch (error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = 'Location permission denied';
              permissionDenied = true;
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = 'Location information is unavailable';
              break;
            case 3: // TIMEOUT
              errorMessage = 'Location request timed out';
              break;
            default:
              errorMessage = error.message || 'Unknown error occurred';
          }

          if (onLocationError) {
            onLocationError(errorMessage);
          }

          resolve({
            success: false,
            error: errorMessage,
            permissionDenied,
          });
        },
        {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge,
        }
      );
    });
  };

  const startLocationTracking = async (options?: LocationOptions): Promise<LocationResult> => {
    if (tracking.isTracking) {
      return {
        success: true,
        location: tracking.currentLocation,
      };
    }

    const mergedOptions = { ...defaultOptions, ...options };

    return new Promise((resolve) => {
      const watchId = Geolocation.watchPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy || 0,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp || Date.now(),
          };

          setLocation(locationData);
          setTracking(prev => ({
            ...prev,
            isTracking: true,
            currentLocation: locationData,
            trackingHistory: [...prev.trackingHistory.slice(-99), locationData], // Keep last 100 locations
            lastUpdate: Date.now(),
            accuracy: locationData.accuracy || 0,
          }));

          if (onLocationUpdate) {
            onLocationUpdate(locationData);
          }
        },
        (error) => {
          let errorMessage = 'Unknown error occurred';

          switch (error.code) {
            case 1:
              errorMessage = 'Location permission denied';
              break;
            case 2:
              errorMessage = 'Location information is unavailable';
              break;
            case 3:
              errorMessage = 'Location request timed out';
              break;
            default:
              errorMessage = error.message || 'Unknown error occurred';
          }

          setTracking(prev => ({
            ...prev,
            isTracking: false,
          }));

          if (onLocationError) {
            onLocationError(errorMessage);
          }

          resolve({
            success: false,
            error: errorMessage,
          });
        },
        {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge,
          distanceFilter: mergedOptions.distanceFilter,
          useSignificantChanges: mergedOptions.useSignificantChanges,
        }
      );

      setWatchId(watchId);
      setTracking(prev => ({
        ...prev,
        isActive: true,
        isTracking: true,
      }));

      resolve({
        success: true,
      });
    });
  };

  const stopLocationTracking = () => {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setTracking(prev => ({
      ...prev,
      isActive: false,
      isTracking: false,
    }));
  };

  const calculateDistance = (from: LocationData, to: LocationData): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const isWithinRadius = (
    center: LocationData,
    point: LocationData,
    radius: number
  ): boolean => {
    const distance = calculateDistance(center, point);
    return distance <= radius;
  };

  const contextValue: LocationContextType = {
    location,
    tracking,
    getCurrentLocation,
    startLocationTracking,
    stopLocationTracking,
    requestLocationPermission,
    hasLocationPermission,
    calculateDistance,
    isWithinRadius,
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};

// Location Button Component
interface LocationButtonProps {
  onLocationReceived?: (location: LocationData) => void;
  onError?: (error: string) => void;
  style?: any;
  showAccuracy?: boolean;
  enableHighAccuracy?: boolean;
}

export const LocationButton: React.FC<LocationButtonProps> = ({
  onLocationReceived,
  onError,
  style,
  showAccuracy = true,
  enableHighAccuracy = true,
}) => {
  const { getCurrentLocation, requestLocationPermission } = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);

  const handleGetLocation = async () => {
    setIsLoading(true);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to get your current location.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const result = await getCurrentLocation({ enableHighAccuracy });

      if (result.success && result.location) {
        setLastLocation(result.location);
        if (onLocationReceived) {
          onLocationReceived(result.location);
        }
      } else {
        if (onError) {
          onError(result.error || 'Failed to get location');
        }
      }
    } catch (error) {
      if (onError) {
        onError('Failed to get location');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.locationButton, style]}
      onPress={handleGetLocation}
      disabled={isLoading}
    >
      <Icon
        name={isLoading ? 'location-searching' : 'my-location'}
        size={24}
        color="#6C5CE7"
      />
      {lastLocation && showAccuracy && (
        <Text style={styles.accuracyText}>
          ±{Math.round(lastLocation.accuracy || 0)}m
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Location Status Component
interface LocationStatusProps {
  showCoordinates?: boolean;
  showAccuracy?: boolean;
  showTimestamp?: boolean;
  style?: any;
}

export const LocationStatus: React.FC<LocationStatusProps> = ({
  showCoordinates = true,
  showAccuracy = true,
  showTimestamp = false,
  style,
}) => {
  const { location, tracking } = useLocation();

  if (!location) {
    return (
      <View style={[styles.locationStatus, style]}>
        <Icon name="location-off" size={16} color="#7F8C8D" />
        <Text style={styles.statusText}>No location data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.locationStatus, style]}>
      <Icon
        name={tracking.isTracking ? 'location-on' : 'my-location'}
        size={16}
        color={tracking.isTracking ? '#6BCF7F' : '#6C5CE7'}
      />
      <View style={styles.locationInfo}>
        {showCoordinates && (
          <Text style={styles.coordinatesText}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        )}
        {(showAccuracy || showTimestamp) && (
          <Text style={styles.detailsText}>
            {showAccuracy && `±${Math.round(location.accuracy || 0)}m`}
            {showAccuracy && showTimestamp && ' • '}
            {showTimestamp && new Date(location.timestamp).toLocaleTimeString()}
          </Text>
        )}
      </View>
    </View>
  );
};

// Location Map Component (placeholder for integration with map libraries)
interface LocationMapProps {
  location?: LocationData;
  markers?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
  }>;
  radius?: number;
  showUserLocation?: boolean;
  style?: any;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  location,
  markers = [],
  radius,
  showUserLocation = true,
  style,
}) => {
  const { location: currentLocation } = useLocation();
  const displayLocation = location || currentLocation;

  return (
    <View style={[styles.mapContainer, style]}>
      <View style={styles.mapPlaceholder}>
        <Icon name="map" size={48} color="#BDC3C7" />
        <Text style={styles.mapPlaceholderText}>
          Map view would be integrated here
        </Text>
        {displayLocation && (
          <Text style={styles.mapLocationText}>
            Current: {displayLocation.latitude.toFixed(4)}, {displayLocation.longitude.toFixed(4)}
          </Text>
        )}
        {markers.length > 0 && (
          <Text style={styles.mapMarkersText}>
            {markers.length} markers
          </Text>
        )}
        {radius && displayLocation && (
          <Text style={styles.mapRadiusText}>
            Radius: {radius}m
          </Text>
        )}
      </View>
    </View>
  );
};

// Geofencing Component
interface Geofence {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  name?: string;
  onEnter?: () => void;
  onExit?: () => void;
}

interface GeofencingProps {
  geofences: Geofence[];
  onGeofenceEnter?: (geofence: Geofence) => void;
  onGeofenceExit?: (geofence: Geofence) => void;
}

export const Geofencing: React.FC<GeofencingProps> = ({
  geofences,
  onGeofenceEnter,
  onGeofenceExit,
}) => {
  const { location, isWithinRadius } = useLocation();
  const [activeGeofences, setActiveGeofences] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!location) return;

    const newActiveGeofences = new Set<string>();

    geofences.forEach((geofence) => {
      const isInside = isWithinRadius(
        { latitude: geofence.latitude, longitude: geofence.longitude, timestamp: Date.now() },
        location,
        geofence.radius
      );

      if (isInside) {
        newActiveGeofences.add(geofence.id);

        // Check if this is a new entry
        if (!activeGeofences.has(geofence.id)) {
          if (geofence.onEnter) geofence.onEnter();
          if (onGeofenceEnter) onGeofenceEnter(geofence);
        }
      } else {
        // Check if this is an exit
        if (activeGeofences.has(geofence.id)) {
          if (geofence.onExit) geofence.onExit();
          if (onGeofenceExit) onGeofenceExit(geofence);
        }
      }
    });

    setActiveGeofences(newActiveGeofences);
  }, [location, geofences, activeGeofences, isWithinRadius, onGeofenceEnter, onGeofenceExit]);

  return null; // This component works in the background
};

const styles = StyleSheet.create({
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 25,
    gap: 8,
  },
  accuracyText: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  locationInfo: {
    flex: 1,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#2C3E50',
    fontWeight: '500',
  },
  detailsText: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 8,
    textAlign: 'center',
  },
  mapLocationText: {
    fontSize: 12,
    color: '#2C3E50',
    marginTop: 8,
  },
  mapMarkersText: {
    fontSize: 12,
    color: '#2C3E50',
    marginTop: 4,
  },
  mapRadiusText: {
    fontSize: 12,
    color: '#2C3E50',
    marginTop: 4,
  },
});
