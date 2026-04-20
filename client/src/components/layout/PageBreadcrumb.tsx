import { useLocation, Link } from 'wouter';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem,
  BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  fleet: 'Fleet',
  washers: 'Wash Queue',
  shifts: 'Shifts',
  calendar: 'Calendar',
  imports: 'Imports',
  inbox: 'Inbox',
  analytics: 'Analytics',
  'digital-twin': 'Mission Control',
  executive: 'Executive',
  'war-room': 'War Room',
  automations: 'Automations',
  'workspace-memory': 'Workspace Memory',
  knowledge: 'Knowledge Base',
  trust: 'Trust Console',
  users: 'Users',
  settings: 'Settings',
  'system-config': 'System Config',
  'vehicle-intelligence': 'Vehicle Intelligence',
  channels: 'Channels',
  chat: 'Chat',
  shortcuts: 'Shortcuts',
  proposals: 'Proposals',
  'app-builder': 'App Builder',
  workspace: 'Workspace',
  ideas: 'Ideas Hub',
};

export function PageBreadcrumbBar() {
  const [loc] = useLocation();
  if (loc === '/' || loc === '') return null;
  return (
    <div className="px-4 py-1.5 border-b bg-background/50">
      <PageBreadcrumb />
    </div>
  );
}

export default function PageBreadcrumb() {
  const [location] = useLocation();

  if (location === '/' || location === '') return null;

  const segments = location.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          const path = '/' + segments.slice(0, i + 1).join('/');
          const label = ROUTE_LABELS[seg] || decodeURIComponent(seg);

          return (
            <span key={path} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={path}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
