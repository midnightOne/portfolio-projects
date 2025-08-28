"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  Calendar,
  Users,
  BarChart3,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Reflink {
  id: string;
  code: string;
  name?: string;
  description?: string;
  rateLimitTier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'UNLIMITED';
  dailyLimit: number;
  expiresAt?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  
  // Enhanced features
  recipientName?: string;
  recipientEmail?: string;
  customContext?: string;
  tokenLimit?: number;
  tokensUsed: number;
  spendLimit?: number;
  spendUsed: number;
  enableVoiceAI: boolean;
  enableJobAnalysis: boolean;
  enableAdvancedNavigation: boolean;
  lastUsedAt?: string;
}

interface ReflinkUsage {
  totalRequests: number;
  blockedRequests: number;
  uniqueUsers: number;
  totalCost: number;
  averageCostPerRequest: number;
  costBreakdown: {
    llmCosts: number;
    voiceCosts: number;
    processingCosts: number;
  };
  usageByType: Record<string, number>;
  requestsByDay: Array<{
    date: string;
    requests: number;
    blocked: number;
    cost: number;
  }>;
}

const RATE_LIMIT_TIERS = {
  BASIC: { dailyLimit: 10, name: 'Basic', color: 'secondary' },
  STANDARD: { dailyLimit: 50, name: 'Standard', color: 'default' },
  PREMIUM: { dailyLimit: 200, name: 'Premium', color: 'default' },
  UNLIMITED: { dailyLimit: -1, name: 'Unlimited', color: 'default' }
} as const;

export function ReflinksManager() {
  const [reflinks, setReflinks] = useState<Reflink[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [selectedReflink, setSelectedReflink] = useState<Reflink | null>(null);
  const [reflinkUsage, setReflinkUsage] = useState<ReflinkUsage | null>(null);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    description: string;
    rateLimitTier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'UNLIMITED';
    dailyLimit: string;
    expiresAt: string;
    recipientName: string;
    recipientEmail: string;
    customContext: string;
    tokenLimit: string;
    spendLimit: string;
    enableVoiceAI: boolean;
    enableJobAnalysis: boolean;
    enableAdvancedNavigation: boolean;
  }>({
    code: '',
    name: '',
    description: '',
    rateLimitTier: 'STANDARD',
    dailyLimit: '',
    expiresAt: '',
    recipientName: '',
    recipientEmail: '',
    customContext: '',
    tokenLimit: '',
    spendLimit: '',
    enableVoiceAI: true,
    enableJobAnalysis: true,
    enableAdvancedNavigation: true,
  });
  const { toast } = useToast();

  const fetchReflinks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ai/reflinks');
      if (!response.ok) {
        throw new Error('Failed to fetch reflinks');
      }
      const data = await response.json();
      setReflinks(data.data.reflinks);
    } catch (error) {
      console.error('Failed to fetch reflinks:', error);
      toast({
        title: "Error",
        description: "Failed to load reflinks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createReflink = async () => {
    try {
      const payload = {
        code: formData.code,
        name: formData.name || undefined,
        description: formData.description || undefined,
        rateLimitTier: formData.rateLimitTier,
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit) : undefined,
        expiresAt: formData.expiresAt || undefined,
      };

      const response = await fetch('/api/admin/ai/reflinks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create reflink');
      }

      toast({
        title: "Success",
        description: "Reflink created successfully",
      });

      setCreateDialogOpen(false);
      resetForm();
      fetchReflinks();
    } catch (error: any) {
      console.error('Failed to create reflink:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create reflink",
        variant: "destructive",
      });
    }
  };

  const updateReflink = async () => {
    if (!selectedReflink) return;

    try {
      const payload = {
        name: formData.name || undefined,
        description: formData.description || undefined,
        rateLimitTier: formData.rateLimitTier,
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit) : undefined,
        expiresAt: formData.expiresAt || undefined,
        isActive: selectedReflink.isActive,
      };

      const response = await fetch(`/api/admin/ai/reflinks/${selectedReflink.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update reflink');
      }

      toast({
        title: "Success",
        description: "Reflink updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedReflink(null);
      resetForm();
      fetchReflinks();
    } catch (error: any) {
      console.error('Failed to update reflink:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update reflink",
        variant: "destructive",
      });
    }
  };

  const toggleReflinkStatus = async (reflink: Reflink) => {
    try {
      const response = await fetch(`/api/admin/ai/reflinks/${reflink.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !reflink.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle reflink status');
      }

      toast({
        title: "Success",
        description: `Reflink ${!reflink.isActive ? 'activated' : 'deactivated'}`,
      });

      fetchReflinks();
    } catch (error) {
      console.error('Failed to toggle reflink status:', error);
      toast({
        title: "Error",
        description: "Failed to update reflink status",
        variant: "destructive",
      });
    }
  };

  const deleteReflink = async (reflink: Reflink) => {
    if (!confirm(`Are you sure you want to delete the reflink "${reflink.code}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ai/reflinks/${reflink.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete reflink');
      }

      toast({
        title: "Success",
        description: "Reflink deleted successfully",
      });

      fetchReflinks();
    } catch (error) {
      console.error('Failed to delete reflink:', error);
      toast({
        title: "Error",
        description: "Failed to delete reflink",
        variant: "destructive",
      });
    }
  };

  const fetchReflinkUsage = async (reflink: Reflink) => {
    try {
      const response = await fetch(`/api/admin/ai/reflinks/${reflink.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reflink usage');
      }
      const data = await response.json();
      setReflinkUsage(data.data.usage);
      setSelectedReflink(reflink);
      setUsageDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch reflink usage:', error);
      toast({
        title: "Error",
        description: "Failed to load reflink usage statistics",
        variant: "destructive",
      });
    }
  };

  const copyReflinkCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Reflink code copied to clipboard",
    });
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      rateLimitTier: 'STANDARD',
      dailyLimit: '',
      expiresAt: '',
      recipientName: '',
      recipientEmail: '',
      customContext: '',
      tokenLimit: '',
      spendLimit: '',
      enableVoiceAI: true,
      enableJobAnalysis: true,
      enableAdvancedNavigation: true,
    });
  };

  const openEditDialog = (reflink: Reflink) => {
    setSelectedReflink(reflink);
    setFormData({
      code: reflink.code,
      name: reflink.name || '',
      description: reflink.description || '',
      rateLimitTier: reflink.rateLimitTier,
      dailyLimit: reflink.dailyLimit.toString(),
      expiresAt: reflink.expiresAt ? reflink.expiresAt.split('T')[0] : '',
      recipientName: reflink.recipientName || '',
      recipientEmail: reflink.recipientEmail || '',
      customContext: reflink.customContext || '',
      tokenLimit: reflink.tokenLimit?.toString() || '',
      spendLimit: reflink.spendLimit?.toString() || '',
      enableVoiceAI: reflink.enableVoiceAI,
      enableJobAnalysis: reflink.enableJobAnalysis,
      enableAdvancedNavigation: reflink.enableAdvancedNavigation,
    });
    setEditDialogOpen(true);
  };

  useEffect(() => {
    fetchReflinks();
  }, []);

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reflinks Management</h2>
          <p className="text-muted-foreground">
            Create and manage reflink codes for enhanced AI assistant access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchReflinks} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Reflink
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Reflink</DialogTitle>
                <DialogDescription>
                  Create a new reflink code with custom rate limiting settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code">Reflink Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., premium-access"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Premium Access Code"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <Label htmlFor="tier">Rate Limit Tier</Label>
                  <Select
                    value={formData.rateLimitTier}
                    onValueChange={(value: any) => setFormData({ ...formData, rateLimitTier: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_LIMIT_TIERS).map(([key, tier]) => (
                        <SelectItem key={key} value={key}>
                          {tier.name} ({tier.dailyLimit === -1 ? 'Unlimited' : `${tier.dailyLimit}/day`})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dailyLimit">Custom Daily Limit (optional)</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
                    placeholder="Leave empty to use tier default"
                  />
                </div>
                <div>
                  <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  />
                </div>
                
                {/* Enhanced Reflink Features */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Recipient Information</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="recipientName">Recipient Name</Label>
                      <Input
                        id="recipientName"
                        value={formData.recipientName}
                        onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                        placeholder="e.g., John Smith"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipientEmail">Recipient Email (optional)</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        value={formData.recipientEmail}
                        onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                        placeholder="e.g., john@company.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customContext">Custom Context Notes</Label>
                      <Textarea
                        id="customContext"
                        value={formData.customContext}
                        onChange={(e) => setFormData({ ...formData, customContext: e.target.value })}
                        placeholder="Personal notes or context for this recipient..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Budget Controls</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="tokenLimit">Token Limit (optional)</Label>
                      <Input
                        id="tokenLimit"
                        type="number"
                        value={formData.tokenLimit}
                        onChange={(e) => setFormData({ ...formData, tokenLimit: e.target.value })}
                        placeholder="e.g., 100000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="spendLimit">Spend Limit (USD, optional)</Label>
                      <Input
                        id="spendLimit"
                        type="number"
                        step="0.01"
                        value={formData.spendLimit}
                        onChange={(e) => setFormData({ ...formData, spendLimit: e.target.value })}
                        placeholder="e.g., 50.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Feature Access</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enableVoiceAI">Voice AI</Label>
                      <Switch
                        id="enableVoiceAI"
                        checked={formData.enableVoiceAI}
                        onCheckedChange={(checked) => setFormData({ ...formData, enableVoiceAI: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enableJobAnalysis">Job Analysis</Label>
                      <Switch
                        id="enableJobAnalysis"
                        checked={formData.enableJobAnalysis}
                        onCheckedChange={(checked) => setFormData({ ...formData, enableJobAnalysis: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enableAdvancedNavigation">Advanced Navigation</Label>
                      <Switch
                        id="enableAdvancedNavigation"
                        checked={formData.enableAdvancedNavigation}
                        onCheckedChange={(checked) => setFormData({ ...formData, enableAdvancedNavigation: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createReflink} disabled={!formData.code}>
                  Create Reflink
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Reflinks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Reflinks</CardTitle>
          <CardDescription>
            Manage reflink codes and their access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : reflinks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No reflinks created yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Budget Status</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reflinks.map((reflink) => (
                  <TableRow key={reflink.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm">
                          {reflink.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyReflinkCode(reflink.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {reflink.recipientName || reflink.name || 'Unnamed'}
                        </div>
                        {reflink.recipientEmail && (
                          <div className="text-sm text-muted-foreground">
                            {reflink.recipientEmail}
                          </div>
                        )}
                        {reflink.customContext && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                            {reflink.customContext}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={RATE_LIMIT_TIERS[reflink.rateLimitTier].color as any}>
                        {RATE_LIMIT_TIERS[reflink.rateLimitTier].name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {reflink.spendLimit && (
                          <div className="text-sm">
                            <span className="font-medium">
                              ${reflink.spendUsed.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              / ${reflink.spendLimit.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {reflink.tokenLimit && (
                          <div className="text-xs text-muted-foreground">
                            {reflink.tokensUsed.toLocaleString()} / {reflink.tokenLimit.toLocaleString()} tokens
                          </div>
                        )}
                        {!reflink.spendLimit && !reflink.tokenLimit && (
                          <span className="text-sm text-muted-foreground">No limits</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {reflink.enableVoiceAI && (
                          <Badge variant="secondary" className="text-xs">Voice</Badge>
                        )}
                        {reflink.enableJobAnalysis && (
                          <Badge variant="secondary" className="text-xs">Jobs</Badge>
                        )}
                        {reflink.enableAdvancedNavigation && (
                          <Badge variant="secondary" className="text-xs">Nav</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={reflink.isActive}
                          onCheckedChange={() => toggleReflinkStatus(reflink)}
                        />
                        {isExpired(reflink.expiresAt) && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        )}
                        {reflink.spendLimit && reflink.spendUsed >= reflink.spendLimit && (
                          <Badge variant="destructive" className="text-xs">
                            Budget
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchReflinkUsage(reflink)}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(reflink)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReflink(reflink)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reflink</DialogTitle>
            <DialogDescription>
              Update reflink settings and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-code">Reflink Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Premium Access Code"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label htmlFor="edit-tier">Rate Limit Tier</Label>
              <Select
                value={formData.rateLimitTier}
                onValueChange={(value: any) => setFormData({ ...formData, rateLimitTier: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RATE_LIMIT_TIERS).map(([key, tier]) => (
                    <SelectItem key={key} value={key}>
                      {tier.name} ({tier.dailyLimit === -1 ? 'Unlimited' : `${tier.dailyLimit}/day`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-dailyLimit">Custom Daily Limit</Label>
              <Input
                id="edit-dailyLimit"
                type="number"
                value={formData.dailyLimit}
                onChange={(e) => setFormData({ ...formData, dailyLimit: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-expiresAt">Expiration Date</Label>
              <Input
                id="edit-expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>
            
            {/* Enhanced Reflink Features */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Recipient Information</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-recipientName">Recipient Name</Label>
                  <Input
                    id="edit-recipientName"
                    value={formData.recipientName}
                    onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-recipientEmail">Recipient Email</Label>
                  <Input
                    id="edit-recipientEmail"
                    type="email"
                    value={formData.recipientEmail}
                    onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                    placeholder="e.g., john@company.com"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-customContext">Custom Context Notes</Label>
                  <Textarea
                    id="edit-customContext"
                    value={formData.customContext}
                    onChange={(e) => setFormData({ ...formData, customContext: e.target.value })}
                    placeholder="Personal notes or context for this recipient..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Budget Controls</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-tokenLimit">Token Limit</Label>
                  <Input
                    id="edit-tokenLimit"
                    type="number"
                    value={formData.tokenLimit}
                    onChange={(e) => setFormData({ ...formData, tokenLimit: e.target.value })}
                    placeholder="Leave empty for no limit"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-spendLimit">Spend Limit (USD)</Label>
                  <Input
                    id="edit-spendLimit"
                    type="number"
                    step="0.01"
                    value={formData.spendLimit}
                    onChange={(e) => setFormData({ ...formData, spendLimit: e.target.value })}
                    placeholder="Leave empty for no limit"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Feature Access</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-enableVoiceAI">Voice AI</Label>
                  <Switch
                    id="edit-enableVoiceAI"
                    checked={formData.enableVoiceAI}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableVoiceAI: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-enableJobAnalysis">Job Analysis</Label>
                  <Switch
                    id="edit-enableJobAnalysis"
                    checked={formData.enableJobAnalysis}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableJobAnalysis: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-enableAdvancedNavigation">Advanced Navigation</Label>
                  <Switch
                    id="edit-enableAdvancedNavigation"
                    checked={formData.enableAdvancedNavigation}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableAdvancedNavigation: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateReflink}>
              Update Reflink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Dialog */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reflink Usage Statistics</DialogTitle>
            <DialogDescription>
              Usage statistics for reflink: {selectedReflink?.code}
            </DialogDescription>
          </DialogHeader>
          {reflinkUsage && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{reflinkUsage.totalRequests}</div>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{reflinkUsage.blockedRequests}</div>
                    <p className="text-sm text-muted-foreground">Blocked Requests</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{reflinkUsage.uniqueUsers}</div>
                    <p className="text-sm text-muted-foreground">Unique Users</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">${reflinkUsage.totalCost.toFixed(2)}</div>
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Cost Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>LLM Costs:</span>
                        <span>${reflinkUsage.costBreakdown.llmCosts.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Voice Costs:</span>
                        <span>${reflinkUsage.costBreakdown.voiceCosts.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing:</span>
                        <span>${reflinkUsage.costBreakdown.processingCosts.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Usage by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(reflinkUsage.usageByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="capitalize">{type.replace('_', ' ')}:</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Daily Usage & Costs (Last 30 Days)</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reflinkUsage.requestsByDay.map((day, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 rounded border">
                      <span>{day.date}</span>
                      <div className="flex items-center gap-4">
                        <span>{day.requests} requests</span>
                        <span className="font-medium">${day.cost.toFixed(2)}</span>
                        {day.blocked > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {day.blocked} blocked
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}