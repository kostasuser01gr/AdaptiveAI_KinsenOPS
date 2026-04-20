import { useEffect } from 'react';
import { useLocation } from 'wouter';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Chat',
  '/dashboard': 'Dashboard',
  '/fleet': 'Fleet',
  '/washers': 'Wash Queue',
  '/shifts': 'Shifts',
  '/calendar': 'Calendar',
  '/imports': 'Imports',
  '/inbox': 'Ops Inbox',
  '/analytics': 'Analytics',
  '/digital-twin': 'Mission Control',
  '/executive': 'Executive Intelligence',
  '/war-room': 'War Room',
  '/automations': 'Automations',
  '/workspace-memory': 'Workspace Memory',
  '/knowledge': 'Knowledge Base',
  '/trust': 'Trust Console',
  '/users': 'Users',
  '/settings': 'Settings',
  '/system-config': 'System Config',
  '/vehicle-intelligence': 'Vehicle Intelligence',
  '/channels': 'Channels',
  '/shortcuts': 'Shortcuts',
  '/proposals': 'Proposals',
  '/app-builder': 'App Builder',
  '/workspace': 'Workspace',
  '/ideas': 'Ideas Hub',
};

const APP_NAME = 'DriveAI';

export function useDocumentTitle() {
  const [location] = useLocation();

  useEffect(() => {
    const basePath = '/' + (location.split('/').filter(Boolean)[0] || '');
    const title = ROUTE_TITLES[basePath];
    document.title = title ? `${title} — ${APP_NAME}` : APP_NAME;
  }, [location]);
}
