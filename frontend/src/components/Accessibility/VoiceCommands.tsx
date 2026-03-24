/**
 * VoiceCommands Component
 * Provides voice command functionality for accessibility
 */

import React, { useEffect, useState, useRef } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { VoiceCommandUtils } from '../../utils/accessibilityUtils';

interface VoiceCommandsProps {
  children?: React.ReactNode;
  className?: string;
  customCommands?: Record<string, () => void>;
  showIndicator?: boolean;
}

export const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  children,
  className = '',
  customCommands = {},
  showIndicator = true
}) => {
  const { isVoiceSupported, isVoiceListening, startVoiceCommands, toggleVoiceListening, announce } = useAccessibility();
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [error, setError] = useState<string>('');
  const indicatorRef = useRef<HTMLDivElement>(null);

  // Default voice commands
  const defaultCommands = {
    'navigate home': () => {
      window.location.href = '/';
      announce('Navigating to home page');
    },
    'navigate dashboard': () => {
      window.location.href = '/dashboard';
      announce('Navigating to dashboard');
    },
    'navigate search': () => {
      window.location.href = '/search';
      announce('Navigating to search');
    },
    'toggle high contrast': () => {
      const event = new CustomEvent('toggleHighContrast');
      document.dispatchEvent(event);
      announce('Toggling high contrast mode');
    },
    'toggle voice commands': () => {
      toggleVoiceListening();
    },
    'help': () => {
      announce('Voice commands available: navigate home, navigate dashboard, navigate search, toggle high contrast, toggle voice commands, help');
    }
  };

  // Initialize voice commands
  useEffect(() => {
    if (!isVoiceSupported || isInitialized) return;

    const allCommands = { ...defaultCommands, ...customCommands };
    const success = startVoiceCommands(allCommands);
    
    if (success) {
      setIsInitialized(true);
      announce('Voice commands initialized');
    } else {
      setError('Voice commands not supported');
    }
  }, [isVoiceSupported, isInitialized, customCommands, startVoiceCommands, announce]);

  // Visual feedback for voice commands
  useEffect(() => {
    if (isVoiceListening && indicatorRef.current) {
      indicatorRef.current.classList.add('listening');
    } else if (indicatorRef.current) {
      indicatorRef.current.classList.remove('listening');
    }
  }, [isVoiceListening]);

  if (!isVoiceSupported) {
    return (
      <div className={`voice-commands ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`voice-commands ${className}`} role="region" aria-label="Voice commands">
      {/* Voice command indicator */}
      {showIndicator && (
        <div
          ref={indicatorRef}
          className={`fixed bottom-4 right-4 z-50 p-3 rounded-lg transition-all duration-300 ${
            isVoiceListening 
              ? 'bg-green-500 text-white shadow-lg animate-pulse' 
              : 'bg-gray-200 text-gray-600'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isVoiceListening ? 'bg-white animate-ping' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium">
              {isVoiceListening ? 'Listening...' : 'Voice Commands'}
            </span>
          </div>
          
          {lastCommand && (
            <div className="mt-2 text-xs opacity-75">
              Last: {lastCommand}
            </div>
          )}
        </div>
      )}

      {/* Voice command controls */}
      <div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-50 
                      focus:bg-white focus:border-2 focus:border-blue-600 focus:rounded-lg 
                      focus:p-4 focus:shadow-lg"
           role="group"
           aria-label="Voice command controls">
        <h3 className="font-bold mb-2">Voice Commands</h3>
        <button
          onClick={toggleVoiceListening}
          className="block w-full text-left px-2 py-1 mb-1 border rounded"
          aria-pressed={isVoiceListening}
        >
          {isVoiceListening ? 'Stop Listening' : 'Start Listening'}
        </button>
        
        <div className="text-sm text-gray-600 mt-2">
          <p>Available commands:</p>
          <ul className="list-disc list-inside mt-1">
            <li>Navigate home</li>
            <li>Navigate dashboard</li>
            <li>Navigate search</li>
            <li>Toggle high contrast</li>
            <li>Toggle voice commands</li>
            <li>Help</li>
          </ul>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="sr-only" role="alert" aria-live="assertive">
          Voice command error: {error}
        </div>
      )}

      {/* Render children */}
      {children}
    </div>
  );
};

export default VoiceCommands;
