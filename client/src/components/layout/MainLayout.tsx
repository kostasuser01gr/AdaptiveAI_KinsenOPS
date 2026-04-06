import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import {
  Menu, Zap, Search as SearchIcon, Bell, Mic, Clock, FileText, Settings, WifiOff, X,
  Car, Droplets, CalendarDays, Activity, BarChart3, Shield, Eye, Brain, ShieldCheck,
  Command, Database, Calendar, FileUp, Inbox, Users, ChevronRight, AlertCircle,
  CheckCircle2, Info, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const IconMap: Record<string, React.ReactNode> = {
  'Clock': <Clock className="h-3.5 w-3.5" />,
  'FileText': <FileText className="h-3.5 w-3.5" />,
  'Zap': <Zap className="h-3.5 w-3.5" />,
  'Settings': <Settings className="h-3.5 w-3.5" />
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertCircle className="h-4 w-4 text-red-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  info: <Info className="h-4 w-4 text-blue-400" />,
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen, isMobile, t, isOffline, voiceMode, setVoiceMode, customActions } = useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentActions, setRecentActions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('driveai_recent_actions') || '[]'); } catch { return []; }
  });

  const { data: notificationsData } = useQuery({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: moduleRegistryData } = useQuery<Array<{ id: number; slug: string; name: string; route: string; icon?: string; requiredRole?: string | null; enabled: boolean }>>({
    queryKey: ["/api/module-registry"],
    enabled: !!user,
  });

  const trackAction = (label: string) => {
    setRecentActions(prev => {
      const updated = [label, ...prev.filter(a => a !== label)].slice(0, 8);
      localStorage.setItem('driveai_recent_actions', JSON.stringify(updated));
      return updated;
    });
  };

  const navTracked = (path: string, label?: string) => {
    setCmdOpen(false);
    trackAction(label || path);
    navigate(path);
  };

  const { data: searchResults } = useQuery({
    queryKey: ["/api/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      return res.json();
    },
    enabled: !!searchQuery.trim() && cmdOpen,
  });

  const { data: activityData } = useQuery({
    queryKey: ["/api/activity-feed"],
    enabled: !!user && notifOpen,
  });

  const notifications = Array.isArray(notificationsData) ? notificationsData : [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/notifications/${id}/read`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/notifications/read-all"); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const deleteActionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/custom-actions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-actions"] });
    },
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const toggleVoice = () => {
    if (voiceMode === 'idle') {
      setVoiceMode('listening');
      setShowVoiceOverlay(true);
      setTimeout(() => setVoiceMode('speaking'), 3000);
    } else {
      setVoiceMode('idle');
      setShowVoiceOverlay(false);
    }
  };

  const nav = (path: string) => { navTracked(path); };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      <Sidebar />
      
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {showVoiceOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-8">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center ${voiceMode === 'listening' ? 'bg-primary/20 animate-pulse' : 'bg-primary/50'}`}>
              <Mic className={`w-16 h-16 ${voiceMode === 'listening' ? 'text-primary' : 'text-white'}`} />
            </div>
            <h2 className="text-2xl font-semibold">
              {voiceMode === 'listening' ? 'Listening...' : 'DriveAI is speaking...'}
            </h2>
            <Button variant="outline" size="lg" onClick={toggleVoice} className="rounded-full px-8">End Voice Mode</Button>
          </div>
        </div>
      )}

      {notifOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
          <div className="fixed right-0 top-0 z-50 w-[380px] h-full bg-card border-l shadow-2xl flex flex-col" data-testid="notification-drawer">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Notifications</h3>
                {unreadCount > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{unreadCount}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => markAllReadMutation.mutate()} data-testid="button-mark-all-read">
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNotifOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {notifications.length > 0 ? notifications.slice(0, 30).map((n: any) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${!n.read ? 'bg-primary/5 border-primary/20' : 'border-transparent'}`}
                    onClick={() => { if (!n.read) markReadMutation.mutate(n.id); }}
                    data-testid={`notification-item-${n.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {SEVERITY_ICON[n.severity] || <Info className="h-4 w-4 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</span>
                          {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mb-3 text-green-500/50" />
                    <p className="text-sm font-medium">All caught up</p>
                    <p className="text-xs">No notifications</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            {Array.isArray(activityData) && activityData.length > 0 && (
              <div className="border-t">
                <div className="px-4 py-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Activity className="h-3 w-3" /> Recent Activity
                </div>
                <ScrollArea className="max-h-40">
                  <div className="px-4 pb-3 space-y-2">
                    {activityData.slice(0, 8).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                        <span className="font-medium text-foreground/80">{a.actorName}</span>
                        <span>{a.action}</span>
                        {a.entityLabel && <span className="text-primary truncate">{a.entityLabel}</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </>
      )}

      <main className={`flex-1 flex flex-col min-w-0 h-full transition-all duration-300 ease-in-out relative ${sidebarOpen && !isMobile ? 'md:ml-[280px]' : 'ml-0'}`}>
        {isOffline && (
          <div className="bg-destructive text-destructive-foreground px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2">
            <WifiOff className="h-3.5 w-3.5" /> You are offline. Working from local cache.
          </div>
        )}

        <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center gap-2 flex-1">
            {(!sidebarOpen || isMobile) && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-9 w-9 text-muted-foreground hover:text-foreground mr-1">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1 max-w-xl flex items-center gap-2 bg-muted/50 border hover:border-border/80 hover:bg-muted/80 transition-colors rounded-full h-9 px-3 cursor-text group"
              onClick={() => setCmdOpen(true)}>
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground flex-1 truncate">{t('search')}...</span>
              <div className="hidden sm:flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                <kbd className="h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {customActions.map(action => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <div className="relative group">
                    <Button variant="outline" size="sm" className="hidden md:flex gap-1.5 h-8 rounded-full border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                      data-testid={`custom-action-${action.id}`}>
                      {IconMap[action.icon] || <Zap className="h-3.5 w-3.5" />}
                      <span className="font-medium text-xs">{action.label}</span>
                    </Button>
                    <button
                      onClick={() => deleteActionMutation.mutate(action.id)}
                      className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center"
                      data-testid={`delete-action-${action.id}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>AI-Generated Action (hover to remove)</TooltipContent>
              </Tooltip>
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={toggleVoice}>
                  <Mic className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Hands-free Voice Mode</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full relative" onClick={() => setNotifOpen(true)} data-testid="button-notifications">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-2 w-2 items-center justify-center rounded-full bg-destructive" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('notifications')} ({unreadCount})</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-muted cursor-pointer transition-colors ml-1">
                  <div className="flex h-2 w-2 rounded-full bg-green-500 ring-2 ring-background animate-pulse" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p className="font-semibold mb-1">{t('app_health')}: Operational</p>
                  <p className="text-muted-foreground">All systems running</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">{children}</div>
      </main>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search plates, people, modules, or ask AI..." onValueChange={setSearchQuery} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Array.isArray(searchResults) && searchResults.length > 0 && (
            <CommandGroup heading="Search Results">
              {searchResults.map((r: any, i: number) => (
                <CommandItem key={i} className="cursor-pointer" onSelect={() => {
                  if (r.type === 'vehicle') nav('/fleet');
                  else if (r.type === 'user') nav('/users');
                  else if (r.type === 'station') nav('/digital-twin');
                }}>
                  <div className="flex items-center gap-2">
                    {r.type === 'vehicle' && <Car className="h-4 w-4 text-primary" />}
                    {r.type === 'user' && <Users className="h-4 w-4 text-blue-400" />}
                    {r.type === 'station' && <Activity className="h-4 w-4 text-green-400" />}
                    <span className="font-medium">{r.label}</span>
                    {r.description && <span className="text-xs text-muted-foreground ml-1">({r.description})</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {recentActions.length > 0 && !searchQuery.trim() && (
            <CommandGroup heading="Recent">
              {recentActions.slice(0, 5).map((label, i) => (
                <CommandItem key={`recent-${i}`} className="cursor-pointer" onSelect={() => {
                  const route = label.startsWith('/') ? label : undefined;
                  if (route) nav(route);
                }}>
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />{label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Ask DriveAI">
            <CommandItem className="cursor-pointer" onSelect={() => nav('/')}>
              <div className="flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4" />
                <span>Ask: "Summarize today's delays"</span>
              </div>
            </CommandItem>
            <CommandItem className="cursor-pointer" onSelect={() => nav('/')}>
              <div className="flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4" />
                <span>Ask: "Which vehicles need attention?"</span>
              </div>
            </CommandItem>
          </CommandGroup>
          {customActions.length > 0 && (
            <CommandGroup heading="Custom Actions">
              {customActions.map(action => (
                <CommandItem key={action.id} onSelect={() => {
                  setCmdOpen(false);
                  trackAction(action.label);
                  if (action.target?.startsWith('/')) navigate(action.target);
                }}>
                  {IconMap[action.icon] || <Zap className="mr-2 h-4 w-4" />} {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => navTracked('/fleet', 'Add new vehicle')}>Add new vehicle to fleet</CommandItem>
            <CommandItem onSelect={() => navTracked('/automations', 'Create automation')}>Create automation rule</CommandItem>
            <CommandItem onSelect={() => navTracked('/war-room', 'Open war room')}>Open new war room</CommandItem>
            <CommandItem onSelect={() => navTracked('/workspace-memory', 'Teach AI')}>Teach AI a new rule</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Operations">
            <CommandItem onSelect={() => nav('/fleet')}><Car className="mr-2 h-4 w-4" />Fleet Intelligence</CommandItem>
            <CommandItem onSelect={() => nav('/washers')}><Droplets className="mr-2 h-4 w-4" />Washer Queue</CommandItem>
            <CommandItem onSelect={() => nav('/shifts')}><CalendarDays className="mr-2 h-4 w-4" />Shift Management</CommandItem>
            <CommandItem onSelect={() => nav('/inbox')}><Inbox className="mr-2 h-4 w-4" />Operations Inbox</CommandItem>
            <CommandItem onSelect={() => nav('/vehicle-intelligence')}><Eye className="mr-2 h-4 w-4" />Vehicle Intelligence</CommandItem>
            <CommandItem onSelect={() => nav('/analytics')}><BarChart3 className="mr-2 h-4 w-4" />Analytics & Reports</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Intelligence & Governance">
            <CommandItem onSelect={() => nav('/digital-twin')}><Activity className="mr-2 h-4 w-4" />Digital Twin — Mission Control</CommandItem>
            <CommandItem onSelect={() => nav('/executive')}><BarChart3 className="mr-2 h-4 w-4" />Executive Intelligence</CommandItem>
            <CommandItem onSelect={() => nav('/war-room')}><Shield className="mr-2 h-4 w-4" />War Room & Collaboration</CommandItem>
            <CommandItem onSelect={() => nav('/automations')}><Zap className="mr-2 h-4 w-4" />Automation Builder</CommandItem>
            <CommandItem onSelect={() => nav('/workspace-memory')}><Brain className="mr-2 h-4 w-4" />Workspace Memory & AI Learning</CommandItem>
            <CommandItem onSelect={() => nav('/knowledge')}><Database className="mr-2 h-4 w-4" />Knowledge Base</CommandItem>
            <CommandItem onSelect={() => nav('/trust')}><ShieldCheck className="mr-2 h-4 w-4" />Trust & Compliance Console</CommandItem>
          </CommandGroup>
          {Array.isArray(moduleRegistryData) && moduleRegistryData.filter(m => m.enabled && !['fleet','washers','shifts','analytics','digital-twin','executive','war-room','automations','workspace-memory','knowledge','trust','inbox','vehicle-intelligence','settings','users'].includes(m.slug)).length > 0 && (
            <CommandGroup heading="More Modules">
              {moduleRegistryData.filter(m => m.enabled && !['fleet','washers','shifts','analytics','digital-twin','executive','war-room','automations','workspace-memory','knowledge','trust','inbox','vehicle-intelligence','settings','users'].includes(m.slug)).map(m => (
                <CommandItem key={m.id} onSelect={() => navTracked(m.route, m.name)}>
                  <Command className="mr-2 h-4 w-4" />{m.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => nav('/settings')}><Settings className="mr-2 h-4 w-4" />Settings & Preferences</CommandItem>
            <CommandItem onSelect={() => nav('/users')}><Users className="mr-2 h-4 w-4" />User Management</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
