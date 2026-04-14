import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ListOrdered, Clock, Shield, Monitor, MessageSquare } from 'lucide-react';

const CATEGORIES = [
  { key: "critical", label: "Critical Alerts", desc: "SLA breaches, system failures, security events", icon: AlertTriangle, color: "destructive" },
  { key: "queue", label: "Queue Updates", desc: "Wash queue status changes, assignments", icon: ListOrdered, color: "default" },
  { key: "shift", label: "Shift Reminders", desc: "Upcoming shift changes, swap requests", icon: Clock, color: "default" },
  { key: "incident", label: "Incidents", desc: "New incidents, escalations, resolutions", icon: Shield, color: "secondary" },
  { key: "system", label: "System", desc: "Maintenance, deployment, configuration changes", icon: Monitor, color: "outline" },
  { key: "chat", label: "Chat", desc: "Direct messages, channel mentions", icon: MessageSquare, color: "default" },
] as const;

type Pref = { category: string; inApp: boolean; email: boolean; push: boolean; sound: boolean };

export function NotificationPreferencesPanel() {
  const queryClient = useQueryClient();
  const { data: prefs, isLoading } = useQuery<Pref[]>({ queryKey: ["/api/user/notification-preferences"] });

  const update = useMutation({
    mutationFn: async ({ category, ...body }: { category: string; inApp?: boolean; email?: boolean; push?: boolean; sound?: boolean }) => {
      await apiRequest("PUT", `/api/user/notification-preferences/${category}`, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user/notification-preferences"] }),
  });

  const getPref = (cat: string): Pref => {
    const p = (prefs ?? []).find(p => p.category === cat);
    return p ?? { category: cat, inApp: true, email: false, push: false, sound: true };
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 px-4 text-xs text-muted-foreground font-medium">
        <div>Category</div>
        <div className="text-center">In-App</div>
        <div className="text-center">Email</div>
        <div className="text-center">Sound</div>
      </div>
      {CATEGORIES.map(({ key, label, desc, icon: Icon }) => {
        const p = getPref(key);
        return (
          <div key={key} className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center p-4 border rounded-lg bg-card/50">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="space-y-0.5 min-w-0">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground truncate">{desc}</p>
              </div>
            </div>
            <div className="flex justify-center">
              <Switch checked={p.inApp} onCheckedChange={(v) => update.mutate({ ...p, category: key, inApp: v })} />
            </div>
            <div className="flex justify-center">
              <Switch checked={p.email} onCheckedChange={(v) => update.mutate({ ...p, category: key, email: v })} />
            </div>
            <div className="flex justify-center">
              <Switch checked={p.sound} onCheckedChange={(v) => update.mutate({ ...p, category: key, sound: v })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
