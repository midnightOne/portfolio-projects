'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Trash2,
  Settings,
  Brain
} from 'lucide-react';
import { 
  AIConversation, 
  AIMessage, 
  AIProvider, 
  ProjectWithRelations, 
  ParsedChanges,
  TextSelection 
} from '@/lib/types/project';

interface AIChatSidebarProps {
  project: ProjectWithRelations;
  isOpen: boolean;
  onToggle: () => void;
  onContentUpdate: (updates: Partial<ProjectWithRelations>) => void;
  selectedText?: TextSelection;
}

export function AIChatSidebar({ 
  project, 
  isOpen, 
  onToggle, 
  onContentUpdate, 
  selectedText 
}: AIChatSidebarProps) {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<AIConversation | null>(null);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (project.id && project.id !== 'new-project') {
        fetchConversations();
      }
      fetchProviders();
    }
  }, [isOpen, project.id]);

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);

  const fetchConversations = async () => {
    if (!project.id || project.id === 'new-project') {
      setConversations([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/ai/conversations/${project.id}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        if (data.length > 0 && !currentConversation) {
          setCurrentConversation(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/ai/providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim() || loading) return;

    // For new projects, we'll simulate AI responses locally
    if (project.id === 'new-project') {
      handleNewProjectAIResponse();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          message: message.trim(),
          conversationId: currentConversation?.id,
          selectedText
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const result = await response.json();
      
      // Update current conversation
      setCurrentConversation(result.conversation);
      
      // Update conversations list
      setConversations(prev => {
        const updated = prev.filter(c => c.id !== result.conversation.id);
        return [result.conversation, ...updated];
      });

      // Clear message
      setMessage('');

      // If there are parsed changes, show them for review
      if (result.parsedChanges) {
        handleParsedChanges(result.parsedChanges);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleNewProjectAIResponse = () => {
    setLoading(true);
    
    // Simulate AI response for new projects
    setTimeout(() => {
      const mockMessage = {
        id: `msg-${Date.now()}`,
        conversationId: 'new-conversation',
        role: 'assistant' as const,
        content: getSimulatedAIResponse(message, project),
        timestamp: new Date(),
        model: 'claude-3-5-sonnet',
        tokens: 150,
        context: null
      };

      // Create or update mock conversation
      const mockConversation = {
        id: 'new-conversation',
        projectId: 'new-project',
        title: message.substring(0, 50),
        createdAt: new Date(),
        lastActiveAt: new Date(),
        messages: [
          ...(currentConversation?.messages || []),
          {
            id: `msg-user-${Date.now()}`,
            conversationId: 'new-conversation',
            role: 'user' as const,
            content: message,
            timestamp: new Date(),
            model: null,
            tokens: null,
            context: null
          },
          mockMessage
        ]
      };

      setCurrentConversation(mockConversation);
      setMessage('');
      setLoading(false);

      // Try to parse the response for changes
      try {
        const changes = JSON.parse(mockMessage.content);
        if (changes.changes) {
          handleParsedChanges(changes);
        }
      } catch {
        // Not JSON, that's fine
      }
    }, 1000);
  };

  const getSimulatedAIResponse = (userMessage: string, projectData: ProjectWithRelations): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('generate') && lowerMessage.includes('idea')) {
      return JSON.stringify({
        reasoning: "I'll help you brainstorm project ideas based on current trends and your interests.",
        changes: {
          metadata: {
            title: "AI-Powered Task Manager",
            description: "A modern task management application that uses artificial intelligence to prioritize tasks, suggest optimal work schedules, and provide productivity insights. Built with React, Node.js, and machine learning algorithms.",
            briefOverview: "Smart task manager with AI-driven productivity features"
          }
        },
        confidence: 0.8,
        warnings: [],
        modelUsed: "claude-3-5-sonnet",
        tokensUsed: 120
      });
    }
    
    if (lowerMessage.includes('improve') || lowerMessage.includes('writing')) {
      return JSON.stringify({
        reasoning: "I've improved the clarity and engagement of your project description.",
        changes: {
          metadata: {
            description: projectData.description ? 
              `${projectData.description}\n\nThis project demonstrates modern web development practices and showcases innovative problem-solving approaches. The implementation focuses on user experience, performance optimization, and scalable architecture.` :
              "This innovative project showcases cutting-edge technology and creative problem-solving. Built with modern development practices, it demonstrates expertise in full-stack development and user-centered design."
          }
        },
        confidence: 0.9,
        warnings: [],
        modelUsed: "claude-3-5-sonnet",
        tokensUsed: 95
      });
    }
    
    if (lowerMessage.includes('tag')) {
      return JSON.stringify({
        reasoning: "I've suggested relevant tags based on your project content and current tech trends.",
        changes: {
          metadata: {
            tags: {
              add: ["React", "TypeScript", "AI", "Web Development", "Full Stack"],
              remove: [],
              reasoning: "These tags will help categorize your project and improve discoverability"
            }
          }
        },
        confidence: 0.85,
        warnings: [],
        modelUsed: "claude-3-5-sonnet",
        tokensUsed: 80
      });
    }
    
    if (lowerMessage.includes('description')) {
      return JSON.stringify({
        reasoning: "I've created a compelling project description that highlights key features and technical achievements.",
        changes: {
          metadata: {
            description: "An innovative web application that combines modern frontend technologies with robust backend architecture. This project features responsive design, real-time functionality, and optimized performance. Built using industry best practices, it demonstrates proficiency in full-stack development and showcases creative problem-solving skills.",
            briefOverview: "Modern web app showcasing full-stack development expertise"
          }
        },
        confidence: 0.9,
        warnings: [],
        modelUsed: "claude-3-5-sonnet",
        tokensUsed: 110
      });
    }
    
    // Default response
    return `I understand you'd like help with "${userMessage}". For new projects, I can assist with:

• Generating project ideas and concepts
• Writing compelling descriptions
• Suggesting relevant tags
• Improving content clarity and engagement
• Brainstorming features and functionality

Once you save this project, I'll have access to full AI capabilities including conversation history and advanced content analysis. Would you like me to help with any of these areas?`;
  };

  const handleParsedChanges = (changes: ParsedChanges) => {
    // For now, just log the changes. In a full implementation,
    // you'd show a preview dialog and let the user approve changes
    console.log('AI suggested changes:', changes);
    
    // Auto-apply simple changes with high confidence
    if (changes.confidence > 0.8 && changes.warnings.length === 0) {
      const updates: Partial<ProjectWithRelations> = {};
      
      if (changes.metadataChanges?.title) {
        updates.title = changes.metadataChanges.title;
      }
      if (changes.metadataChanges?.description) {
        updates.description = changes.metadataChanges.description;
      }
      if (changes.metadataChanges?.briefOverview) {
        updates.briefOverview = changes.metadataChanges.briefOverview;
      }
      
      if (Object.keys(updates).length > 0) {
        onContentUpdate(updates);
      }
    }
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setMessage('');
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(
        `/api/admin/ai/conversations/${project.id}?conversationId=${conversationId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversation?.id === conversationId) {
          setCurrentConversation(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const formatMessage = (content: string) => {
    // Simple formatting for code blocks and structured responses
    if (content.includes('```')) {
      return content.split('```').map((part, index) => {
        if (index % 2 === 1) {
          return (
            <pre key={index} className="bg-muted p-2 rounded text-sm overflow-x-auto my-2">
              <code>{part}</code>
            </pre>
          );
        }
        return <span key={index}>{part}</span>;
      });
    }
    return content;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onToggle}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="fixed right-4 top-20 z-50">
          <Brain className="h-4 w-4 mr-2" />
          AI Assistant
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Content Assistant
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Conversation List */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Conversations</h3>
              <Button variant="outline" size="sm" onClick={handleNewConversation}>
                New Chat
              </Button>
            </div>
            {project.id === 'new-project' ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 Save your project first to enable full conversation history and advanced AI features.
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-2 rounded cursor-pointer flex items-center justify-between group ${
                      currentConversation?.id === conv.id ? 'bg-muted' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setCurrentConversation(conv)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {conv.title || 'Untitled conversation'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conv.messages.length} messages
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Text Indicator */}
          {selectedText && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-1">Selected Text:</p>
              <p className="text-sm text-blue-700 italic">
                "{selectedText.text.substring(0, 100)}..."
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {currentConversation?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0">
                    {msg.role === 'user' ? (
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <div className="text-sm whitespace-pre-wrap">
                      {formatMessage(msg.content)}
                    </div>
                    {msg.model && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {msg.model}
                        </Badge>
                        {msg.tokens && (
                          <Badge variant="outline" className="text-xs">
                            {msg.tokens} tokens
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={selectedText ? "Ask about the selected text..." : "Ask the AI assistant..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={loading}
                className="flex-1"
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={loading || !message.trim()}
                size="sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {project.id === 'new-project' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMessage('Generate creative project ideas for me')}
                    disabled={loading}
                  >
                    Generate Ideas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMessage('Write a compelling project description')}
                    disabled={loading}
                  >
                    Write Description
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMessage('Suggest relevant tags for this project')}
                    disabled={loading}
                  >
                    Suggest Tags
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMessage('Improve the writing and clarity of this content')}
                    disabled={loading}
                  >
                    Improve Writing
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMessage('Add relevant tags for this project')}
                    disabled={loading}
                  >
                    Suggest Tags
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMessage('Write a better description for this project')}
                    disabled={loading}
                  >
                    Better Description
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}