import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Settings, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function BotConfig() {
  const [config, setConfig] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: botConfig, isLoading } = useQuery({
    queryKey: ["/api/admin/bot-config"],
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/admin/bot-config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bot-config"] });
      toast({
        title: "Success",
        description: "Bot configuration updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update bot configuration",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (botConfig) {
      setConfig(botConfig);
    }
  }, [botConfig]);

  const handleSave = () => {
    if (config) {
      updateConfigMutation.mutate(config);
    }
  };

  const handleReset = () => {
    setConfig({
      ...botConfig,
      messageTemplate: `Hi [Vendor Name], I'm [User Name] from [City].

I'm looking for today's rate for [Material].
Can you please share:
- Latest Rate
- GST %
- Delivery Charges (if any)

Thanks!`
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-8 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-32 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-8 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bot Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Bot Status</p>
                <div className="flex items-center mt-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <p className="text-lg font-semibold text-green-600">Active</p>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Bot className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Messages Today</p>
                <p className="text-2xl font-semibold text-slate-900 mt-2">247</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Response Rate</p>
                <p className="text-2xl font-semibold text-slate-900 mt-2">87%</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Settings className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Bot Configuration</CardTitle>
          <p className="text-sm text-slate-600">Manage bot settings and message templates</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Message Template */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Message Template
            </Label>
            <Textarea
              value={config?.messageTemplate || ""}
              onChange={(e) => setConfig({ ...config, messageTemplate: e.target.value })}
              className="min-h-[120px] resize-none"
              placeholder="Enter message template..."
            />
            <p className="text-xs text-slate-500 mt-2">
              Use variables: [Vendor Name], [User Name], [City], [Material], [Brand], [Quantity]
            </p>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Messages per Minute
              </Label>
              <Input
                type="number"
                value={config?.messagesPerMinute || 20}
                onChange={(e) => setConfig({ ...config, messagesPerMinute: parseInt(e.target.value) })}
                min="1"
                max="60"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Max Vendors per Inquiry
              </Label>
              <Input
                type="number"
                value={config?.maxVendorsPerInquiry || 3}
                onChange={(e) => setConfig({ ...config, maxVendorsPerInquiry: parseInt(e.target.value) })}
                min="1"
                max="10"
              />
            </div>
          </div>

          {/* Bot Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-800">Bot Settings</h4>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Auto-Response Enabled</p>
                <p className="text-xs text-slate-500">Enable automatic responses to common queries</p>
              </div>
              <Switch
                checked={config?.autoResponseEnabled || false}
                onCheckedChange={(checked) => setConfig({ ...config, autoResponseEnabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Bot Active</p>
                <p className="text-xs text-slate-500">Enable or disable the bot globally</p>
              </div>
              <Switch
                checked={config?.botActive || false}
                onCheckedChange={(checked) => setConfig({ ...config, botActive: checked })}
              />
            </div>
          </div>

          {/* Bot Commands */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Bot Commands</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">/start</p>
                  <p className="text-xs text-slate-500">Initialize bot conversation</p>
                </div>
                <Button variant="ghost" size="sm" className="text-primary">
                  Edit
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">/help</p>
                  <p className="text-xs text-slate-500">Show help information</p>
                </div>
                <Button variant="ghost" size="sm" className="text-primary">
                  Edit
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">/status</p>
                  <p className="text-xs text-slate-500">Check inquiry status</p>
                </div>
                <Button variant="ghost" size="sm" className="text-primary">
                  Edit
                </Button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 pt-4 border-t border-slate-200">
            <Button 
              onClick={handleSave}
              disabled={updateConfigMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {updateConfigMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset to Default
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setConfig({ ...config, botActive: false })}
            >
              Stop Bot
            </Button>
          </div>

          {/* Warning */}
          <div className="flex items-start space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Configuration Changes</p>
              <p className="text-xs text-yellow-700 mt-1">
                Changes to bot configuration will take effect immediately. Make sure to test thoroughly before deploying to production.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
