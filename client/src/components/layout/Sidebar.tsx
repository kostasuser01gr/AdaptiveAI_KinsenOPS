import React from 'react';
import { motion } from '@/lib/animations';
import { useApp } from '@/lib/AppContext';
import { useAuth } from '@/lib/useAuth';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Link, useLocation } from 'wouter';
import { 
  Plus, Settings, Settings2, Car, MessageSquare, MoreHorizontal, Pin, Command,
  Database, Users, Droplets, CalendarDays, Calendar, FileUp, Inbox, LayoutDashboard,
  BarChart3, Bot, LogOut, Activity, Zap, Shield, Eye, Brain, ShieldCheck, Crown, ChevronRight, Building2, FileCheck, Hash, Blocks, EyeOff, Pencil, PanelLeftClose, PanelLeft, LayoutGrid, Lightbulb
} from 'lucide-react';
import FeedbackDialog from '@/components/FeedbackDialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePageLayout } from "@/hooks/useLayoutPreferences";
import { hasMinRole } from "../../../../shared/roles";
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  supervisor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  coordinator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  agent: 'bg-green-500/20 text-green-400 border-green-500/30',
};

function hasAccess(userRole: string, requiredLevel: number) {
  return hasMinRole(userRole, requiredLevel);
}

export default function Sidebar() {
  const { sidebarOpen, sidebarCollapsed, setSidebarCollapsed, t } = useApp();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const collapsed = sidebarCollapsed && !useApp().isMobile;

  const { data: conversations } = useQuery({ queryKey: queryKeys.conversations.all(), enabled: !!user });
  const { data: notificationsData } = useQuery({ queryKey: queryKeys.notifications.all(), enabled: !!user });
  const { data: dashStats } = useQuery<{ vehicles: number; washQueue: number; shifts: number; users: number; stations: number; automations: number; warRooms: number; unreadNotifications: number; pendingShiftRequests: number }>({ queryKey: queryKeys.dashboard.stats(), enabled: !!user, refetchInterval: 30000 });

  const unreadCount = Array.isArray(notificationsData) ? notificationsData.filter((n: any) => !n.read).length : 0;
  const pinnedConversations = Array.isArray(conversations) ? conversations.filter((c: any) => c.pinned) : [];
  const isModuleActive = (path: string) => location === path || location.startsWith(path + '/');
  const role = user?.role || 'agent';
  const station = (user as any)?.station;

  const handleLogout = async () => { try { await logout(); } catch (_e) { /* no-op */ } };

  // Per-user sidebar personalization — hide nav items (RBAC gates remain enforced)
  const { get: getSidebarPref, set: setSidebarPref } = usePageLayout('sidebar');
  const hiddenItems = getSidebarPref<string[]>('hidden', []);
  const [editMode, setEditMode] = React.useState(false);
  const isHidden = (href: string) => hiddenItems.includes(href);
  const toggleHidden = (href: string) => {
    const next = isHidden(href) ? hiddenItems.filter((h: string) => h !== href) : [...hiddenItems, href];
    setSidebarPref('hidden', next);
  };

  const sidebarWidth = collapsed ? 68 : 280;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.nav
      aria-label="Main navigation"
      className="fixed inset-y-0 left-0 z-40 bg-sidebar flex flex-col border-r border-sidebar-border"
      initial={false}
      animate={{
        width: sidebarWidth,
        x: sidebarOpen ? 0 : -sidebarWidth,
      }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 35 }}
    >
      <div className="flex items-center justify-between p-3 h-14">
        {collapsed ? (
          <Button variant="ghost" className="w-full h-10 px-0" asChild>
            <Link href="/">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0 shadow-sm">
                <Car className="h-4 w-4 text-primary-foreground" />
              </div>
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" className="flex-1 justify-start gap-2 h-10 px-2 mr-2 hover:bg-sidebar-accent rounded-lg" asChild>
            <Link href="/">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0 shadow-sm">
                <Car className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-[15px] truncate tracking-tight text-sidebar-foreground">DriveAI Workspace</span>
            </Link>
          </Button>
        )}
        {!collapsed && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground" onClick={() => setSidebarCollapsed(true)} aria-label="Collapse sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {station && !collapsed && (
        <div className="mx-3 mb-1 px-3 py-1.5 rounded-lg bg-sidebar-accent/50 border border-sidebar-border flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-sidebar-foreground/70 truncate">{station}</span>
        </div>
      )}

      <ScrollArea className="flex-1 px-3">
        <div className="py-2 flex flex-col gap-1">
          <Button variant={location === '/' ? 'secondary' : 'ghost'} className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start px-3'} h-10 rounded-lg group`} asChild>
            <Link href="/">
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} w-full`}>
                <Bot className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="font-medium text-sm flex-1">{t('new_chat')}</span>}
                {!collapsed && <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
            </Link>
          </Button>
          <Button variant={isModuleActive('/inbox') ? 'secondary' : 'ghost'} className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start px-3'} h-10 rounded-lg`} asChild>
            <Link href="/inbox">
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} w-full`}>
                <Inbox className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="font-medium text-sm flex-1">{t('ops_inbox')}</span>}
                {!collapsed && unreadCount > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]" data-testid="badge-unread-count">{unreadCount}</Badge>}
              </div>
            </Link>
          </Button>
        </div>

        {!collapsed && (
          <div className="mt-4 mb-2 px-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase">{t('operations')}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditMode(!editMode)} data-testid="button-sidebar-edit">
              <Pencil className={`h-3 w-3 ${editMode ? 'text-primary' : 'text-sidebar-foreground/30'}`} />
            </Button>
          </div>
        )}
        {collapsed && <div className="mt-3 mb-2 border-t border-sidebar-border" />}
        <div className="flex flex-col gap-0.5">
          <NavItem href="/dashboard" icon={<LayoutDashboard />} label={t('dashboard')} active={isModuleActive('/dashboard')} hidden={isHidden('/dashboard')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/fleet" icon={<Car />} label={t('fleet')} active={isModuleActive('/fleet')} badge={dashStats?.vehicles} hidden={isHidden('/fleet')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/washers" icon={<Droplets />} label={t('washers')} active={isModuleActive('/washers')} badge={dashStats?.washQueue} hidden={isHidden('/washers')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/shifts" icon={<CalendarDays />} label={t('shifts')} active={isModuleActive('/shifts')} badgeVariant={(dashStats?.pendingShiftRequests ?? 0) > 0 ? 'warning' : undefined} badge={(dashStats?.pendingShiftRequests ?? 0) > 0 ? dashStats?.pendingShiftRequests : undefined} hidden={isHidden('/shifts')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/calendar" icon={<Calendar />} label={t('calendar')} active={isModuleActive('/calendar')} hidden={isHidden('/calendar')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/imports" icon={<FileUp />} label={t('imports')} active={isModuleActive('/imports')} hidden={isHidden('/imports')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/vehicle-intelligence" icon={<Eye />} label={t('vehicle_intel')} active={isModuleActive('/vehicle-intelligence')} hidden={isHidden('/vehicle-intelligence')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/channels" icon={<Hash />} label={t('channels')} active={isModuleActive('/channels')} hidden={isHidden('/channels')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
        </div>

        {!collapsed && <div className="mt-4 mb-2 px-3 text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase">{t('intelligence')}</div>}
        {collapsed && <div className="mt-2 mb-2 border-t border-sidebar-border" />}
        <div className="flex flex-col gap-0.5">
          <NavItem href="/digital-twin" icon={<Activity />} label={t('digital_twin')} active={isModuleActive('/digital-twin')} hidden={isHidden('/digital-twin')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          {hasAccess(role, 2) && <NavItem href="/executive" icon={<BarChart3 />} label={t('executive')} active={isModuleActive('/executive')} hidden={isHidden('/executive')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />}
          <NavItem href="/analytics" icon={<BarChart3 />} label={t('analytics')} active={isModuleActive('/analytics')} hidden={isHidden('/analytics')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/war-room" icon={<Shield />} label={t('war_room')} active={isModuleActive('/war-room')} badge={dashStats?.warRooms} hidden={isHidden('/war-room')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
        </div>

        {!collapsed && <div className="mt-4 mb-2 px-3 text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase">{t('platform')}</div>}
        {collapsed && <div className="mt-2 mb-2 border-t border-sidebar-border" />}
        <div className="flex flex-col gap-0.5">
          <NavItem href="/automations" icon={<Zap />} label={t('automations')} active={isModuleActive('/automations')} badge={dashStats?.automations} hidden={isHidden('/automations')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          {hasAccess(role, 2) && <NavItem href="/workspace-memory" icon={<Brain />} label={t('workspace_memory')} active={isModuleActive('/workspace-memory')} hidden={isHidden('/workspace-memory')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />}
          <NavItem href="/shortcuts" icon={<Command />} label={t('shortcuts')} active={isModuleActive('/shortcuts')} hidden={isHidden('/shortcuts')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          {hasAccess(role, 2) && <NavItem href="/proposals" icon={<FileCheck />} label={t('proposals')} active={isModuleActive('/proposals')} hidden={isHidden('/proposals')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />}
          {hasAccess(role, 2) && <NavItem href="/app-builder" icon={<Blocks />} label={t('app_builder')} active={isModuleActive('/app-builder')} hidden={isHidden('/app-builder')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />}
          <NavItem href="/workspace" icon={<LayoutGrid />} label="Workspace" active={isModuleActive('/workspace')} hidden={isHidden('/workspace')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/ideas" icon={<Lightbulb />} label="Ideas Hub" active={isModuleActive('/ideas')} hidden={isHidden('/ideas')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
          <NavItem href="/knowledge" icon={<Database />} label={t('knowledge_base')} active={isModuleActive('/knowledge')} hidden={isHidden('/knowledge')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
        </div>

        {hasAccess(role, 3) && (
          <>
            {!collapsed && <div className="mt-4 mb-2 px-3 text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase">{t('governance')}</div>}
            {collapsed && <div className="mt-2 mb-2 border-t border-sidebar-border" />}
            <div className="flex flex-col gap-0.5">
              <NavItem href="/trust" icon={<ShieldCheck />} label={t('trust_console')} active={isModuleActive('/trust')} hidden={isHidden('/trust')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
              <NavItem href="/users" icon={<Users />} label={t('users')} active={isModuleActive('/users')} hidden={isHidden('/users')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
              <NavItem href="/system-config" icon={<Settings2 />} label={t('system_config')} active={isModuleActive('/system-config')} hidden={isHidden('/system-config')} editMode={editMode} onToggle={toggleHidden} collapsed={collapsed} />
            </div>
          </>
        )}

        {!collapsed && (
          <>
            <div className="mt-4 mb-2 px-3 text-xs font-semibold text-sidebar-foreground/50 tracking-wider uppercase">{t('pinned')}</div>
            <div className="flex flex-col gap-0.5 pb-4">
              {pinnedConversations.length > 0 ? (
                pinnedConversations.map((c: any) => (
                  <ThreadItem key={c.id} id={c.id.toString()} label={c.title} isThread={true} />
                ))
              ) : (
                <p className="px-3 text-xs text-sidebar-foreground/40 italic">{t('no_pinned_threads')}</p>
              )}
            </div>
          </>
        )}
      </ScrollArea>

      <div className="p-3 border-t border-sidebar-border bg-sidebar">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar">
              <PanelLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link href="/settings"><Settings className="h-4 w-4 text-sidebar-foreground/60" /></Link>
            </Button>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 relative">
              <span className="text-xs font-bold text-primary">{user?.displayName?.[0] || 'U'}</span>
            </div>
          </div>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-12 px-2 hover:bg-sidebar-accent rounded-xl" data-testid="button-user-menu">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 relative">
                    <span className="text-xs font-bold text-primary">{user?.displayName?.[0] || 'U'}</span>
                    {role === 'admin' && <Crown className="absolute -top-1 -right-1 h-3 w-3 text-amber-400" />}
                  </div>
                  <div className="flex flex-col items-start flex-1 truncate">
                    <span className="text-sm font-semibold text-sidebar-foreground" data-testid="text-user-displayname">{user?.displayName || 'User'}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`h-4 px-1.5 text-[9px] font-semibold uppercase border ${ROLE_COLORS[role] || ''}`} data-testid="badge-user-role">
                        {role}
                      </Badge>
                      {station && <span className="text-[10px] text-sidebar-foreground/50">{station}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/40" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[250px] mb-2">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>{t('account')}</span>
                  <Badge variant="outline" className={`text-[9px] uppercase ${ROLE_COLORS[role] || ''}`}>{role}</Badge>
                </DropdownMenuLabel>
                {hasAccess(role, 3) && (
                  <>
                    <Link href="/users"><DropdownMenuItem className="cursor-pointer py-2"><Users className="mr-2 h-4 w-4" /><span>{t('users')}</span></DropdownMenuItem></Link>
                    <Link href="/trust"><DropdownMenuItem className="cursor-pointer py-2"><ShieldCheck className="mr-2 h-4 w-4" /><span>Trust & Compliance</span></DropdownMenuItem></Link>
                  </>
                )}
                <Link href="/settings"><DropdownMenuItem className="cursor-pointer py-2"><Settings className="mr-2 h-4 w-4" /><span>{t('settings')}</span></DropdownMenuItem></Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer py-2 text-primary" onClick={() => window.open('/washer', '_blank')}>{t('launch_washer_kiosk')}</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer py-2 text-primary" onClick={() => window.open('/customer', '_blank')}>{t('launch_customer_portal')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer py-2 text-destructive" onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="mr-2 h-4 w-4" /> {t('log_out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <FeedbackDialog />
          </>
        )}
      </div>
    </motion.nav>
  );
}

function NavItem({ href, icon, label, active, badge, badgeVariant, hidden, editMode, onToggle, collapsed }: { href: string, icon: React.ReactNode, label: string, active: boolean, badge?: number, badgeVariant?: 'warning', hidden?: boolean, editMode?: boolean, onToggle?: (href: string) => void, collapsed?: boolean }) {
  if (hidden && !editMode) return null;

  const content = (
    <div className="flex items-center gap-0.5">
      <Button 
        variant={active ? 'secondary' : 'ghost'} 
        aria-current={active ? 'page' : undefined}
        className={`${collapsed ? 'w-full justify-center px-0' : 'flex-1 justify-start px-3'} h-9 text-sm rounded-md transition-colors ${
          active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        } ${hidden ? 'opacity-40' : ''}`}
        asChild
      >
        <Link href={href}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} w-full`}>
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-4 w-4 shrink-0" })}
            {!collapsed && <span className="truncate flex-1">{label}</span>}
            {!collapsed && badge !== undefined && badge > 0 && (
              <Badge variant={badgeVariant === 'warning' ? 'secondary' : 'outline'} className={`h-5 px-1.5 text-[10px] font-mono ${badgeVariant === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'text-muted-foreground'}`}>
                {badge}
              </Badge>
            )}
          </div>
        </Link>
      </Button>
      {!collapsed && editMode && onToggle && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onToggle(href)}>
          {hidden ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-sidebar-foreground/60" />}
        </Button>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <span>{label}</span>
          {badge !== undefined && badge > 0 && <Badge variant="outline" className="ml-2 h-4 px-1 text-[9px]">{badge}</Badge>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function ThreadItem({ id, label, isThread }: { id: string, label: string, isThread?: boolean }) {
  const [location] = useLocation();
  const active = location === `/chat/${id}`;
  return (
    <Button variant="ghost" className={`w-full justify-start h-8 px-3 text-sm rounded-md transition-colors group ${
      active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
    }`} asChild>
      <Link href={`/chat/${id}`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 truncate">
            {isThread ? <Pin className="h-3.5 w-3.5 shrink-0 fill-current/20" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{label}</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </div>
        </div>
      </Link>
    </Button>
  );
}
