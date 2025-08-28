"use client";

import React from 'react';
import { useReflinkSession } from '@/components/providers/reflink-session-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Bot, Shield, Zap, MessageSquare } from 'lucide-react';

export function ReflinkStatusIndicator() {
  const {
    isLoading,
    session,
    accessLevel,
    featureAvailability,
    welcomeMessage,
    accessMessage,
    personalizedContext,
    budgetStatus,
    refreshSession,
  } = useReflinkSession();

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Initializing AI Assistant...</span>
        </CardContent>
      </Card>
    );
  }

  const getAccessLevelBadge = () => {
    const variants = {
      no_access: 'destructive',
      basic: 'secondary',
      limited: 'default',
      premium: 'default',
    } as const;

    const colors = {
      no_access: 'text-red-600',
      basic: 'text-gray-600',
      limited: 'text-blue-600',
      premium: 'text-green-600',
    } as const;

    return (
      <Badge variant={variants[accessLevel]} className={colors[accessLevel]}>
        {accessLevel.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getAccessIcon = () => {
    switch (accessLevel) {
      case 'no_access':
        return <Shield className="h-5 w-5 text-red-500" />;
      case 'basic':
        return <MessageSquare className="h-5 w-5 text-gray-500" />;
      case 'limited':
        return <Bot className="h-5 w-5 text-blue-500" />;
      case 'premium':
        return <Zap className="h-5 w-5 text-green-500" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-4 w-full max-w-md">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            {getAccessIcon()}
            AI Assistant Status
            {getAccessLevelBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Welcome Message */}
          {welcomeMessage && (
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertDescription>{welcomeMessage}</AlertDescription>
            </Alert>
          )}

          {/* Access Message */}
          {accessMessage && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">{accessMessage.title}</div>
                  <div className="text-sm">{accessMessage.description}</div>
                  {accessMessage.actionText && accessMessage.actionUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={accessMessage.actionUrl}>{accessMessage.actionText}</a>
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Feature Availability */}
          {featureAvailability && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Available Features:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`flex items-center gap-1 ${featureAvailability.chatInterface ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${featureAvailability.chatInterface ? 'bg-green-500' : 'bg-gray-300'}`} />
                  Chat Interface
                </div>
                <div className={`flex items-center gap-1 ${featureAvailability.voiceAI ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${featureAvailability.voiceAI ? 'bg-green-500' : 'bg-gray-300'}`} />
                  Voice AI
                </div>
                <div className={`flex items-center gap-1 ${featureAvailability.jobAnalysis ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${featureAvailability.jobAnalysis ? 'bg-green-500' : 'bg-gray-300'}`} />
                  Job Analysis
                </div>
                <div className={`flex items-center gap-1 ${featureAvailability.advancedNavigation ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${featureAvailability.advancedNavigation ? 'bg-green-500' : 'bg-gray-300'}`} />
                  Navigation
                </div>
              </div>
              {featureAvailability.dailyLimit > 0 && (
                <div className="text-xs text-gray-600">
                  Daily Limit: {featureAvailability.dailyLimit} requests
                </div>
              )}
            </div>
          )}

          {/* Budget Status (for premium users) */}
          {budgetStatus && session && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Budget Status:</div>
              <div className="text-xs space-y-1">
                {budgetStatus.tokensRemaining !== undefined && (
                  <div>Tokens Remaining: {budgetStatus.tokensRemaining.toLocaleString()}</div>
                )}
                <div>Budget Remaining: ${budgetStatus.spendRemaining.toFixed(2)}</div>
                <div>Est. Requests: {budgetStatus.estimatedRequestsRemaining}</div>
                {budgetStatus.isExhausted && (
                  <Alert>
                    <AlertDescription className="text-red-600">
                      Budget exhausted. Contact for renewal.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {/* Personalized Context (for premium users) */}
          {personalizedContext && personalizedContext.recipientName && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Personalized for:</div>
              <div className="text-sm text-gray-600">{personalizedContext.recipientName}</div>
              {personalizedContext.emphasizedTopics && personalizedContext.emphasizedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {personalizedContext.emphasizedTopics.map((topic, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <Button 
            onClick={refreshSession} 
            variant="outline" 
            size="sm" 
            className="w-full"
          >
            Refresh Status
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}