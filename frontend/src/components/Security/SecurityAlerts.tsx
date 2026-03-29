import React, { useState, useEffect } from 'react';

// Matches the backend ThreatEvent interface
export interface ThreatEvent {
  id: string;
  timestamp: string;
  type: string;
  severity: string;
  sourceIp?: string;
  userId?: string;
  description: string;
  actionTaken: boolean;
}

export const SecurityAlerts: React.FC = () => {
  const [events, setEvents] = useState<ThreatEvent[]>([]);

  useEffect(() => {
    // In a real app, this would use WebSockets or Server-Sent Events for real-time alerts
    // For now we simulate an empty list that gets populated by the service
    setEvents([
      {
        id: 'evt-1',
        timestamp: new Date().toISOString(),
        type: 'ANOMALY',
        severity: 'HIGH',
        userId: 'us-west-1-user',
        description: 'AI Anomaly detected: Login Time Anomaly',
        actionTaken: false
      }
    ]);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'CRITICAL': return 'bg-red-600';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (events.length === 0) {
    return <div className="text-gray-400 p-4 text-center">No recent security events. System is secure.</div>;
  }

  return (
    <div className="space-y-4">
      {events.map(event => (
        <div key={event.id} className="bg-gray-800 flex items-start p-4 rounded shadow-md border-l-4 border-gray-600 transition-all hover:bg-gray-750">
          <div className={`mt-1 h-3 w-3 rounded-full ${getSeverityColor(event.severity)} shadow-sm mr-4`}></div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-white">{event.type}</h4>
              <span className="text-xs text-gray-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="text-sm text-gray-300 mt-1">{event.description}</p>
            
            <div className="mt-2 flex gap-4 text-xs">
              {event.sourceIp && <span className="text-gray-400">IP: <span className="text-gray-200">{event.sourceIp}</span></span>}
              {event.userId && <span className="text-gray-400">User: <span className="text-gray-200">{event.userId}</span></span>}
            </div>
            
            {event.actionTaken && (
              <div className="mt-2 text-xs text-green-400 font-semibold bg-green-900 bg-opacity-20 inline-block px-2 py-1 rounded">
                ✓ Automated Response Executed
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
