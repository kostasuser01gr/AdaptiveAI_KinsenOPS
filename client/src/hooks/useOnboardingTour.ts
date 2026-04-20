import { useEffect, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'adaptiveai_onboarding_complete';

const tourSteps = [
  {
    element: '[data-testid="text-page-title"], [data-testid="button-model-select"]',
    popover: {
      title: 'Welcome to AdaptiveAI',
      description: 'Your AI-powered operations platform. This is your chat interface — ask anything about your fleet, washes, or operations.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-testid="button-sidebar-edit"]',
    popover: {
      title: 'Sidebar Navigation',
      description: 'Access all modules from the sidebar. Click the pencil to customize which items appear. Hover items to see keyboard shortcuts.',
      side: 'right' as const,
    },
  },
  {
    element: '[data-testid="badge-unread-count"], [href="/inbox"]',
    popover: {
      title: 'Ops Inbox',
      description: 'Actionable notifications, alerts, and approvals land here. Critical items are highlighted. Use ⌘⇧I to jump here instantly.',
      side: 'right' as const,
    },
  },
  {
    popover: {
      title: 'Command Palette (⌘K)',
      description: 'Press ⌘K anytime to search vehicles, people, modules, or ask the AI a question. It\'s the fastest way to navigate.',
    },
  },
  {
    element: '[data-testid="button-notifications"]',
    popover: {
      title: 'Notifications & Activity',
      description: 'Real-time alerts and team activity. Click the bell to open the notification panel with unread items and recent actions.',
      side: 'bottom' as const,
    },
  },
];

export function useOnboardingTour() {
  const isComplete = () => localStorage.getItem(TOUR_KEY) === 'true';

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0,0,0,0.65)',
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: 'onboarding-popover',
      steps: tourSteps,
      onDestroyStarted: () => {
        localStorage.setItem(TOUR_KEY, 'true');
        driverObj.destroy();
      },
    });
    driverObj.drive();
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_KEY);
  }, []);

  // Auto-start on first visit after a short delay
  useEffect(() => {
    if (isComplete()) return;
    const timer = setTimeout(() => {
      // Only start if the sidebar is visible (user is authenticated and on main app)
      if (document.querySelector('[data-testid="button-sidebar-edit"]')) {
        startTour();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [startTour]);

  return { startTour, resetTour, isComplete: isComplete() };
}
