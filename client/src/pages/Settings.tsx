import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/AppContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Key, Settings as SettingsIcon, Workflow, ShieldCheck, Save, Brain, Bell, Smartphone, User, Download, Volume2, Palette, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/useAuth";
import { usePWA } from "@/components/pwa/InstallPrompt";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { NotificationPreferencesPanel } from "@/components/settings/NotificationPreferencesPanel";

export default function SettingsPage() {
  const { t, theme, setTheme, language, setLanguage, sidebarOpen, isMobile, notificationSoundEnabled, setNotificationSoundEnabled, notificationVolume, setNotificationVolume } = useApp();
  const { canInstall, isInstalled, triggerInstall } = usePWA();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery<any[]>({ queryKey: ["/api/user-preferences"] });
  const { data: memoryData } = useQuery<any[]>({ queryKey: ["/api/workspace-memory"] });
  const memories = Array.isArray(memoryData) ? memoryData : [];
  const savePref = useMutation({
    mutationFn: async (data: { category: string; key: string; value: any }) => {
      await apiRequest("POST", "/api/user-preferences", { ...data, scope: "personal" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({ title: "Preference saved" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const allPrefs = Array.isArray(prefs) ? prefs : [];
  const getPref = (category: string, key: string, fallback: any = null) => {
    const p = allPrefs.find((p: any) => p.category === category && p.key === key);
    return p ? p.value : fallback;
  };

  const handleSave = () => {
    savePref.mutate({ category: 'workspace', key: 'company_name', value: companyName });
  };

  const [companyName, setCompanyName] = useState('DriveAI Car Rentals');

  useEffect(() => {
    const saved = getPref('workspace', 'company_name', null);
    if (saved) setCompanyName(saved);
  }, [allPrefs.length]);

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-sm border-b transition-all ${isMobile ? 'pl-14' : (sidebarOpen ? '' : 'pl-14')}`}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{t('settings')}</h1>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 md:p-6 lg:px-24">
        <div className="max-w-5xl mx-auto pb-12 flex flex-col md:flex-row gap-8">
          
          <Tabs defaultValue="portals" className="w-full flex flex-col md:flex-row gap-6" orientation="vertical">
            <TabsList className="flex flex-col h-auto w-full md:w-56 bg-transparent space-y-1 justify-start items-stretch">
              <TabsTrigger value="general" className="justify-start data-[state=active]:bg-muted"><SettingsIcon className="w-4 h-4 mr-2" /> General</TabsTrigger>
              <TabsTrigger value="workspace" className="justify-start data-[state=active]:bg-muted"><ShieldCheck className="w-4 h-4 mr-2" /> Workspace</TabsTrigger>
              <TabsTrigger value="portals" className="justify-start data-[state=active]:bg-muted"><Smartphone className="w-4 h-4 mr-2" /> Satellite Portals</TabsTrigger>
              <TabsTrigger value="integrations" className="justify-start data-[state=active]:bg-muted"><Workflow className="w-4 h-4 mr-2" /> Integrations</TabsTrigger>
              <TabsTrigger value="keys" className="justify-start data-[state=active]:bg-muted"><Key className="w-4 h-4 mr-2" /> API Keys</TabsTrigger>
              <TabsTrigger value="memory" className="justify-start data-[state=active]:bg-muted"><Brain className="w-4 h-4 mr-2" /> Memory</TabsTrigger>
              <TabsTrigger value="notifications" className="justify-start data-[state=active]:bg-muted"><Bell className="w-4 h-4 mr-2" /> Notifications</TabsTrigger>
              <TabsTrigger value="personal" className="justify-start data-[state=active]:bg-muted"><User className="w-4 h-4 mr-2" /> My Workspace</TabsTrigger>
            </TabsList>

            <div className="flex-1 w-full min-w-0">
              
              {/* SATELLITE PORTALS TAB */}
              <TabsContent value="portals" className="m-0 space-y-6">
                
                {/* Customer Portal */}
                <Card className="glass-panel border-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Customer QR Portal
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">Active</Badge>
                        </CardTitle>
                        <CardDescription>Standalone experience for customers to upload damage photos via QR code.</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open('/customer', '_blank')}>Preview App</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-2">
                      <Label>Photo Upload Destination</Label>
                      <Select defaultValue="gdrive">
                        <SelectTrigger>
                          <SelectValue placeholder="Select storage provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gdrive">Google Drive (Default)</SelectItem>
                          <SelectItem value="dropbox">Dropbox (Integration needed)</SelectItem>
                          <SelectItem value="aws">AWS S3 (Custom Connector)</SelectItem>
                          <SelectItem value="webhook">Custom Webhook Endpoint</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Configurable storage target to maintain privacy and data ownership.</p>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Customer Chat Channel</Label>
                        <p className="text-xs text-muted-foreground">Allow customers to message operations directly per reservation.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="pt-4 border-t flex justify-end">
                      <Button variant="ghost" className="text-destructive hover:bg-destructive/10">Disable Portal</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Washers Portal */}
                <Card className="glass-panel border-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Washers Kiosk App
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">Active</Badge>
                        </CardTitle>
                        <CardDescription>No-login installable PWA for washer queue and chat.</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open('/washer', '_blank')}>Preview App</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Require Device Token</Label>
                        <p className="text-xs text-muted-foreground">Only allow access from authorized company tablets.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* General Tab */}
              <TabsContent value="general" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Theme Gallery</CardTitle>
                    <CardDescription>Choose a visual theme for your workspace.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {([
                        { id: 'light' as const, label: 'Light', colors: ['#fff', '#f5f5f5', '#7c3aed'] },
                        { id: 'dark' as const, label: 'Dark Glass', colors: ['#111', '#1a1a1a', '#8b5cf6'] },
                        { id: 'midnight' as const, label: 'Midnight', colors: ['#0a0e1a', '#141a2e', '#3b82f6'] },
                        { id: 'sunset' as const, label: 'Sunset', colors: ['#1a110e', '#261a14', '#f59e0b'] },
                        { id: 'ocean' as const, label: 'Ocean', colors: ['#0a1519', '#0e1f26', '#14b8a6'] },
                        { id: 'forest' as const, label: 'Forest', colors: ['#0a1510', '#0e261a', '#22c55e'] },
                      ] as const).map(t => (
                        <button
                          key={t.id}
                          className={`relative flex flex-col gap-2 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] ${theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`}
                          onClick={() => setTheme(t.id)}
                        >
                          <div className="flex gap-1 h-8">
                            {t.colors.map((c, i) => (
                              <div key={i} className="flex-1 rounded-md" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                          <span className="text-xs font-medium">{t.label}</span>
                          {theme === t.id && (
                            <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Volume2 className="h-5 w-5" /> Notification Sounds</CardTitle>
                    <CardDescription>Configure audio alerts for notifications and events.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Enable Sounds</Label>
                        <p className="text-xs text-muted-foreground">Play audio when new notifications arrive.</p>
                      </div>
                      <Switch checked={notificationSoundEnabled} onCheckedChange={setNotificationSoundEnabled} />
                    </div>
                    {notificationSoundEnabled && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Volume</Label>
                          <span className="text-xs text-muted-foreground">{Math.round(notificationVolume * 100)}%</span>
                        </div>
                        <Slider
                          value={[notificationVolume]}
                          onValueChange={([v]) => setNotificationVolume(v)}
                          min={0} max={1} step={0.05}
                          className="w-full"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Locale</CardTitle>
                    <CardDescription>Language and regional settings.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col space-y-2">
                      <Label className="text-base">Language</Label>
                      <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select Language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="el">Ελληνικά</SelectItem>
                          <SelectItem value="de">Deutsch</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Install App</CardTitle>
                    <CardDescription>Install DriveAI as a native app on your device.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isInstalled ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>DriveAI is installed on this device.</span>
                      </div>
                    ) : canInstall ? (
                      <Button onClick={triggerInstall} className="gap-2">
                        <Download className="h-4 w-4" /> Install DriveAI
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Open DriveAI in Chrome or Edge to install as an app.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Workspace Tab */}
              <TabsContent value="workspace" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Workspace Configuration</CardTitle>
                    <CardDescription>Define the persona and behavior of the DriveAI assistant.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-2">
                      <Label htmlFor="company">Company Name</Label>
                      <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                    </div>
                    <Button onClick={handleSave} disabled={savePref.isPending}>
                      <Save className="w-4 h-4 mr-2" /> {savePref.isPending ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Integrations Tab */}
              <TabsContent value="integrations" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Connected Services</CardTitle>
                    <CardDescription>Enable DriveAI to access your operational tools.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col p-4 border rounded-xl gap-3 bg-card hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                          <span className="text-blue-600 dark:text-blue-400 font-bold text-xl">G</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">Google Workspace</h4>
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">Connected</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Drive storage used for Customer Photo uploads.</p>
                      <Button variant="secondary" size="sm" className="w-full mt-1">Configure Target Folder</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Personal Workspace Tab */}
              <TabsContent value="personal" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>My Workspace</CardTitle>
                    <CardDescription>Personal settings isolated to your account. Other users cannot see these.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Sidebar Collapsed</Label>
                        <p className="text-xs text-muted-foreground">Start with sidebar collapsed by default.</p>
                      </div>
                      <Switch
                        checked={getPref('layout', 'sidebar_collapsed', false)}
                        onCheckedChange={(checked) => savePref.mutate({ category: 'layout', key: 'sidebar_collapsed', value: checked })}
                        data-testid="switch-sidebar-collapsed"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>AI Response Language</Label>
                      <Select
                        value={getPref('ai', 'response_language', 'en')}
                        onValueChange={(val) => savePref.mutate({ category: 'ai', key: 'response_language', value: val })}
                      >
                        <SelectTrigger data-testid="select-ai-language"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="el">Ελληνικά</SelectItem>
                          <SelectItem value="auto">Auto-detect</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Language for AI assistant responses in your workspace.</p>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Desktop Notifications</Label>
                        <p className="text-xs text-muted-foreground">Show browser push notifications for alerts.</p>
                      </div>
                      <Switch
                        checked={getPref('notifications', 'desktop_enabled', true)}
                        onCheckedChange={(checked) => savePref.mutate({ category: 'notifications', key: 'desktop_enabled', value: checked })}
                        data-testid="switch-desktop-notifications"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Compact View</Label>
                        <p className="text-xs text-muted-foreground">Use condensed layout for tables and lists.</p>
                      </div>
                      <Switch
                        checked={getPref('layout', 'compact_view', false)}
                        onCheckedChange={(checked) => savePref.mutate({ category: 'layout', key: 'compact_view', value: checked })}
                        data-testid="switch-compact-view"
                      />
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Logged in as <span className="font-semibold">{user?.displayName}</span> ({user?.role})
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* API Keys Tab */}
              <TabsContent value="keys" className="m-0 space-y-6">
                <ApiKeysManager />
              </TabsContent>

              {/* Memory Tab */}
              <TabsContent value="memory" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Workspace Memory</CardTitle>
                    <CardDescription>Knowledge the AI assistant has learned about your workspace operations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {memories.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Brain className="h-4 w-4" />
                          <span>{memories.length} knowledge entries stored</span>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {memories.slice(0, 50).map((m: any) => (
                            <div key={m.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/20">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                                  <span className="text-xs font-medium truncate">{m.key}</span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{m.value}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(m.updatedAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/20">
                        <Brain className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">No workspace memories yet</p>
                          <p className="text-xs text-muted-foreground">The AI assistant will build workspace memory as it learns about your operations through conversations.</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="m-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Configure per-category notification channels.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <NotificationPreferencesPanel />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Sound</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Notification Sound</Label>
                        <p className="text-xs text-muted-foreground">Play a sound when notifications arrive.</p>
                      </div>
                      <Switch checked={notificationSoundEnabled} onCheckedChange={setNotificationSoundEnabled} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </div>
          </Tabs>

        </div>
      </ScrollArea>
    </div>
  );
}
