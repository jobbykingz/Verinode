import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  User,
  MessageSquare,
  Shield,
  Eye,
  Archive,
  AlertCircle,
  Zap
} from 'lucide-react';

interface SuspiciousAlertProps {
  alert: {
    id: string;
    proofId: string;
    proofHash: string;
    issuerAddress: string;
    alertType: 'suspicious_pattern' | 'high_risk' | 'critical_threat' | 'fraud_detected' | 'anomaly_detected';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    suspiciousPatterns: string[];
    riskScore: number;
    confidence: number;
    evidence: {
      validationScore: any;
      patternMatches: Array<{
        pattern: string;
        confidence: number;
        description: string;
      }>;
      similarCases: Array<{
        proofId: string;
        similarity: number;
        outcome: string;
      }>;
    };
    status: 'open' | 'investigating' | 'resolved' | 'false_positive';
    assignedTo?: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    resolutionNotes?: string;
  };
  onStatusUpdate?: (alertId: string, status: string, notes?: string, assignedTo?: string) => void;
  onAssign?: (alertId: string, assignedTo: string) => void;
  currentUser?: string;
}

const SuspiciousAlert: React.FC<SuspiciousAlertProps> = ({
  alert,
  onStatusUpdate,
  onAssign,
  currentUser = 'current-user'
}) => {
  const [expanded, setExpanded] = useState(false);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState(alert.assignedTo || '');
  const [selectedStatus, setSelectedStatus] = useState(alert.status);

  useEffect(() => {
    setAssignedTo(alert.assignedTo || '');
    setSelectedStatus(alert.status);
  }, [alert.assignedTo, alert.status]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'low':
        return <AlertCircle className="h-4 w-4" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'critical':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'false_positive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-3 w-3" />;
      case 'investigating':
        return <Clock className="h-3 w-3" />;
      case 'resolved':
        return <CheckCircle className="h-3 w-3" />;
      case 'false_positive':
        return <XCircle className="h-3 w-3" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const handleStatusUpdate = () => {
    if (onStatusUpdate) {
      onStatusUpdate(alert.id, selectedStatus, resolutionNotes, assignedTo);
      setResolutionDialogOpen(false);
    }
  };

  const handleAssign = () => {
    if (onAssign && assignedTo) {
      onAssign(alert.id, assignedTo);
      setAssignDialogOpen(false);
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'suspicious_pattern':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'high_risk':
        return <Shield className="h-5 w-5 text-red-500" />;
      case 'critical_threat':
        return <Zap className="h-5 w-5 text-red-600" />;
      case 'fraud_detected':
        return <XCircle className="h-5 w-5 text-red-700" />;
      case 'anomaly_detected':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card className={`w-full ${alert.severity === 'critical' ? 'border-red-200 border-2' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {getAlertTypeIcon(alert.alertType)}
            <div className="flex-1">
              <CardTitle className="text-lg">{alert.title}</CardTitle>
              <CardDescription className="mt-1">
                Proof ID: {alert.proofId} • Issuer: {alert.issuerAddress.slice(0, 8)}...
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <div className="flex items-center space-x-2">
              <Badge className={getSeverityColor(alert.severity)}>
                {getSeverityIcon(alert.severity)}
                <span className="ml-1">{alert.severity.toUpperCase()}</span>
              </Badge>
              <Badge className={getStatusColor(alert.status)}>
                {getStatusIcon(alert.status)}
                <span className="ml-1">{alert.status.replace('_', ' ').toUpperCase()}</span>
              </Badge>
            </div>
            <div className="text-sm text-gray-500">
              {formatTimeAgo(alert.createdAt)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alert Description */}
        <p className="text-sm text-gray-700">{alert.description}</p>

        {/* Risk Score and Confidence */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Risk Score:</span>
            <span className={`font-bold ${
              alert.riskScore >= 0.8 ? 'text-green-600' :
              alert.riskScore >= 0.6 ? 'text-yellow-600' :
              alert.riskScore >= 0.4 ? 'text-orange-600' : 'text-red-600'
            }`}>
              {(alert.riskScore * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">Confidence:</span>
            <span className="font-bold text-blue-600">
              {(alert.confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {alert.assignedTo && (
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <User className="h-3 w-3" />
                <span>Assigned to: {alert.assignedTo}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {expanded ? 'Hide' : 'Show'} Details
            </Button>
            
            {alert.status === 'open' && (
              <>
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <User className="h-4 w-4 mr-1" />
                      Assign
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Alert</DialogTitle>
                      <DialogDescription>
                        Assign this alert to a team member for investigation.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="assignedTo">Assign To</Label>
                        <Input
                          id="assignedTo"
                          value={assignedTo}
                          onChange={(e) => setAssignedTo(e.target.value)}
                          placeholder="Enter user ID or email"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAssign}>
                        Assign
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={resolutionDialogOpen} onOpenChange={setResolutionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Resolve
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Resolve Alert</DialogTitle>
                      <DialogDescription>
                        Update the status of this security alert.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="investigating">Investigating</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="false_positive">False Positive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="notes">Resolution Notes</Label>
                        <Textarea
                          id="notes"
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Add notes about the resolution..."
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="assignedTo">Assigned To</Label>
                        <Input
                          id="assignedTo"
                          value={assignedTo}
                          onChange={(e) => setAssignedTo(e.target.value)}
                          placeholder="Enter user ID or email"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setResolutionDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleStatusUpdate}>
                        Update Status
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Suspicious Patterns */}
            {alert.suspiciousPatterns.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                  Suspicious Patterns
                </h4>
                <div className="flex flex-wrap gap-2">
                  {alert.suspiciousPatterns.map((pattern, index) => (
                    <Badge key={index} variant="destructive" className="text-xs">
                      {pattern.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Pattern Matches */}
            {alert.evidence.patternMatches.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-blue-500" />
                  Pattern Analysis
                </h4>
                <div className="space-y-2">
                  {alert.evidence.patternMatches.map((match, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{match.description}</div>
                        <div className="text-xs text-gray-600">{match.pattern}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {(match.confidence * 100).toFixed(1)}% confidence
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Cases */}
            {alert.evidence.similarCases.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2 text-purple-500" />
                  Similar Cases
                </h4>
                <div className="space-y-2">
                  {alert.evidence.similarCases.map((case_, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono">{case_.proofId}</span>
                        <Badge variant="outline" className="text-xs">
                          {(case_.similarity * 100).toFixed(1)}% similar
                        </Badge>
                      </div>
                      <Badge 
                        variant={case_.outcome === 'low' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {case_.outcome}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Information */}
            {alert.status !== 'open' && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center">
                  <Archive className="h-4 w-4 mr-2 text-green-500" />
                  Resolution Information
                </h4>
                <div className="space-y-2 text-sm">
                  {alert.assignedTo && (
                    <div>
                      <span className="font-medium">Assigned to:</span> {alert.assignedTo}
                    </div>
                  )}
                  {alert.resolvedAt && (
                    <div>
                      <span className="font-medium">Resolved at:</span> {new Date(alert.resolvedAt).toLocaleString()}
                    </div>
                  )}
                  {alert.resolutionNotes && (
                    <div>
                      <span className="font-medium">Notes:</span> {alert.resolutionNotes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SuspiciousAlert;
