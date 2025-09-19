'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Star,
  StarOff,
  Bot,
  Mic,
  Calendar,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VoiceConfigRecord {
  id: string;
  provider: 'openai' | 'elevenlabs';
  name: string;
  isDefault: boolean;
  configJson: string;
  createdAt: string;
  updatedAt: string;
}

interface VoiceConfigurationListProps {
  configurations: VoiceConfigRecord[];
  onEdit: (config: VoiceConfigRecord) => void;
  onDelete: (configId: string) => void;
  onSetDefault: (configId: string, provider: 'openai' | 'elevenlabs') => void;
  onClone: (config: VoiceConfigRecord) => void;
}

export function VoiceConfigurationList({
  configurations,
  onEdit,
  onDelete,
  onSetDefault,
  onClone
}: VoiceConfigurationListProps) {
  const [selectedProvider, setSelectedProvider] = useState<'all' | 'openai' | 'elevenlabs'>('all');

  const filteredConfigurations = configurations.filter(config => 
    selectedProvider === 'all' || config.provider === selectedProvider
  );

  const getProviderIcon = (provider: 'openai' | 'elevenlabs') => {
    return provider === 'openai' ? <Bot className="h-4 w-4" /> : <Mic className="h-4 w-4" />;
  };

  const getProviderColor = (provider: 'openai' | 'elevenlabs') => {
    return provider === 'openai' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  const parseConfigName = (configJson: string) => {
    try {
      const config = JSON.parse(configJson);
      return config.displayName || 'Unnamed Configuration';
    } catch {
      return 'Invalid Configuration';
    }
  };

  const parseConfigDescription = (configJson: string) => {
    try {
      const config = JSON.parse(configJson);
      return config.description || 'No description';
    } catch {
      return 'Invalid configuration data';
    }
  };

  const parseConfigEnabled = (configJson: string) => {
    try {
      const config = JSON.parse(configJson);
      return config.enabled !== false; // Default to true if not specified
    } catch {
      return false;
    }
  };

  if (configurations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Settings className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Voice Configurations</h3>
          <p className="text-muted-foreground text-center mb-4">
            Get started by creating your first voice AI configuration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={selectedProvider === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedProvider('all')}
        >
          All ({configurations.length})
        </Button>
        <Button
          variant={selectedProvider === 'openai' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedProvider('openai')}
          className="flex items-center gap-2"
        >
          <Bot className="h-4 w-4" />
          OpenAI ({configurations.filter(c => c.provider === 'openai').length})
        </Button>
        <Button
          variant={selectedProvider === 'elevenlabs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedProvider('elevenlabs')}
          className="flex items-center gap-2"
        >
          <Mic className="h-4 w-4" />
          ElevenLabs ({configurations.filter(c => c.provider === 'elevenlabs').length})
        </Button>
      </div>

      {/* Configuration Table */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Configurations</CardTitle>
          <CardDescription>
            Manage your voice AI provider configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConfigurations.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {parseConfigName(config.configJson)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {parseConfigDescription(config.configJson)}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={`${getProviderColor(config.provider)} flex items-center gap-1 w-fit`}
                    >
                      {getProviderIcon(config.provider)}
                      {config.provider === 'openai' ? 'OpenAI' : 'ElevenLabs'}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <Badge 
                      variant={parseConfigEnabled(config.configJson) ? 'default' : 'secondary'}
                    >
                      {parseConfigEnabled(config.configJson) ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    {config.isDefault ? (
                      <Badge variant="default" className="flex items-center gap-1 w-fit">
                        <Star className="h-3 w-3" />
                        Default
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSetDefault(config.id, config.provider)}
                        className="flex items-center gap-1 h-6 px-2 text-xs"
                      >
                        <StarOff className="h-3 w-3" />
                        Set Default
                      </Button>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(config.updatedAt), { addSuffix: true })}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(config)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem onClick={() => onClone(config)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Clone
                        </DropdownMenuItem>
                        
                        {!config.isDefault && (
                          <DropdownMenuItem onClick={() => onSetDefault(config.id, config.provider)}>
                            <Star className="h-4 w-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem 
                          onClick={() => onDelete(config.id)}
                          className="text-red-600 focus:text-red-600"
                          disabled={config.isDefault}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                          {config.isDefault && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              (Default)
                            </span>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredConfigurations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No configurations found for the selected provider.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}