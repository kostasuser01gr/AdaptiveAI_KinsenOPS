import { useState, useCallback } from 'react';
import { useUserTabs, useTabWidgets, useWidgetCatalog } from '@/hooks/useTabWidgets';
import { WidgetShell } from '@/components/widgets/WidgetShell';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MotionDialog } from '@/components/motion/MotionDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LayoutGrid, Plus, X, GripVertical, Pencil, Package, Trash2,
  LayoutDashboard, Car, Activity, BarChart3, MessageSquare, Box
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid, LayoutDashboard, Car, Activity, BarChart3, MessageSquare, Box,
};

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Box,
  fleet: Car,
  ops: Activity,
  analytics: BarChart3,
  chat: MessageSquare,
};

const tabTemplates = [
  { label: 'Dashboard', icon: 'LayoutDashboard', template: 'dashboard', widgets: ['kpi-card', 'fleet-status', 'activity-feed', 'quick-actions', 'notifications'] },
  { label: 'Fleet Ops', icon: 'Car', template: 'fleet', widgets: ['fleet-status', 'station-map', 'reservations', 'incidents'] },
  { label: 'Analytics', icon: 'BarChart3', template: 'analytics', widgets: ['kpi-card', 'anomalies', 'digital-twin', 'activity-feed'] },
  { label: 'My Workspace', icon: 'LayoutGrid', template: null, widgets: [] },
];

export default function Workspace() {
  const { toast } = useToast();
  const { tabs, createTab, updateTab, deleteTab, reorderTabs } = useUserTabs();
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const { widgets: tabWidgets, addWidget, removeWidget, saveLayout } = useTabWidgets(activeTabId);
  const { catalog } = useWidgetCatalog();
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabLabel, setNewTabLabel] = useState('');
  const [newTabTemplate, setNewTabTemplate] = useState<string | null>(null);
  const [editingTab, setEditingTab] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<string>('all');

  // Auto-select first tab
  const currentTab = activeTabId ?? tabs[0]?.id ?? null;

  const handleCreateTab = async () => {
    if (!newTabLabel.trim()) return;
    try {
      const result = await createTab.mutateAsync({ label: newTabLabel, template: newTabTemplate || undefined });
      // If template selected, auto-add widgets
      const tmpl = tabTemplates.find(t => t.template === newTabTemplate);
      if (tmpl && result && 'id' in result) {
        const newTabId = (result as any).id;
        for (let i = 0; i < tmpl.widgets.length; i++) {
          const slug = tmpl.widgets[i];
          const def = catalog.find(c => c.slug === slug);
          await addWidget.mutateAsync({
            widgetSlug: slug,
            x: (i % 3) * 4,
            y: Math.floor(i / 3) * 3,
            w: def?.defaultW ?? 4,
            h: def?.defaultH ?? 3,
          });
        }
      }
      setNewTabLabel('');
      setNewTabTemplate(null);
      setShowAddTab(false);
      toast({ title: 'Tab created' });
    } catch {
      toast({ title: 'Failed to create tab', variant: 'destructive' });
    }
  };

  const handleDeleteTab = async (tabId: number) => {
    await deleteTab.mutateAsync(tabId);
    if (activeTabId === tabId) setActiveTabId(null);
    toast({ title: 'Tab removed' });
  };

  const handleAddWidget = async (slug: string) => {
    if (!currentTab) return;
    const def = catalog.find(c => c.slug === slug);
    await addWidget.mutateAsync({
      widgetSlug: slug,
      x: 0,
      y: 0,
      w: def?.defaultW ?? 4,
      h: def?.defaultH ?? 3,
    });
    toast({ title: `${def?.name || slug} added` });
  };

  const handleLayoutSave = useCallback((layouts: Array<{ id: number; x: number; y: number; w: number; h: number }>) => {
    if (currentTab) saveLayout.mutate(layouts);
  }, [currentTab, saveLayout]);

  const filteredCatalog = catalogFilter === 'all'
    ? catalog
    : catalog.filter(c => c.category === catalogFilter);

  return (
    <PageShell title="Workspace" icon={<LayoutGrid className="h-5 w-5" />} subtitle="Your personal modular workspace">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map(tab => {
          const Icon = iconMap[tab.icon] || LayoutGrid;
          const isActive = (currentTab === tab.id);
          return (
            <div key={tab.id} className="group relative">
              <Button
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className="gap-1.5 text-xs shrink-0 pr-6"
                onClick={() => setActiveTabId(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {editingTab === tab.id ? (
                  <Input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    className="h-5 w-24 text-xs px-1"
                    autoFocus
                    onBlur={() => {
                      if (editLabel.trim()) updateTab.mutate({ id: tab.id, label: editLabel });
                      setEditingTab(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (editLabel.trim()) updateTab.mutate({ id: tab.id, label: editLabel });
                        setEditingTab(null);
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span onDoubleClick={() => { setEditingTab(tab.id); setEditLabel(tab.label); }}>
                    {tab.label}
                  </span>
                )}
              </Button>
              {!tab.isDefault && (
                <button
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Tab */}
        <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0" onClick={() => setShowAddTab(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Tab
            </Button>
        <MotionDialog open={showAddTab} onOpenChange={setShowAddTab} title="Create New Tab" className="sm:max-w-md">
            <div className="space-y-4">
              <Input
                placeholder="Tab name"
                value={newTabLabel}
                onChange={e => setNewTabLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateTab()}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Start from template</label>
                <div className="grid grid-cols-2 gap-2">
                  {tabTemplates.map(t => {
                    const Icon = iconMap[t.icon] || LayoutGrid;
                    return (
                      <button
                        key={t.template ?? 'custom'}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${
                          newTabTemplate === t.template
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setNewTabTemplate(t.template);
                          if (!newTabLabel) setNewTabLabel(t.label);
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <div>
                          <div className="font-medium">{t.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.widgets.length} widgets
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreateTab} disabled={!newTabLabel.trim()}>
                Create Tab
              </Button>
            </div>
        </MotionDialog>

        {/* Widget Gallery */}
        {currentTab && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0 ml-auto">
                <Package className="h-3.5 w-3.5" />
                Add Widget
              </Button>
            </SheetTrigger>
            <SheetContent className="w-80 sm:w-96">
              <SheetHeader>
                <SheetTitle>Widget Gallery</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <div className="flex gap-1 mb-3 flex-wrap">
                  {['all', 'general', 'fleet', 'ops', 'analytics', 'chat'].map(cat => (
                    <Button
                      key={cat}
                      variant={catalogFilter === cat ? 'default' : 'outline'}
                      size="sm"
                      className="text-[10px] h-6 px-2"
                      onClick={() => setCatalogFilter(cat)}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-2">
                    {filteredCatalog.map(def => {
                      const CatIcon = categoryIcons[def.category] || Box;
                      const alreadyAdded = tabWidgets.some(tw => tw.widgetSlug === def.slug);
                      return (
                        <div
                          key={def.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors"
                        >
                          <CatIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{def.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{def.description}</div>
                          </div>
                          <Button
                            size="sm"
                            variant={alreadyAdded ? 'ghost' : 'default'}
                            className="h-7 text-xs shrink-0"
                            onClick={() => handleAddWidget(def.slug)}
                          >
                            {alreadyAdded ? 'Add Again' : 'Add'}
                          </Button>
                        </div>
                      );
                    })}
                    {filteredCatalog.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No widgets in this category
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Widget Grid */}
      {currentTab ? (
        <WidgetShell
          tabId={currentTab}
          tabWidgets={tabWidgets}
          widgetCatalog={catalog}
          onLayoutChange={handleLayoutSave}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
          <LayoutGrid className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No workspace tabs yet</p>
          <p className="text-sm mt-1">Create your first tab to start building your personal workspace</p>
          <Button className="mt-4 gap-2" onClick={() => setShowAddTab(true)}>
            <Plus className="h-4 w-4" />
            Create First Tab
          </Button>
        </div>
      )}
    </PageShell>
  );
}
