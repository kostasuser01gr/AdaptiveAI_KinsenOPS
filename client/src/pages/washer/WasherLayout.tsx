import React from 'react';
import { Link, useLocation } from 'wouter';
import { Droplets, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WasherLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">
      <main className="flex-1 overflow-hidden relative pb-[60px]">
        {children}
      </main>
      
      {/* Mobile-first bottom navigation for washers */}
      <nav className="fixed bottom-0 left-0 w-full h-[60px] bg-background/95 backdrop-blur border-t flex items-center justify-around px-4 z-50 pb-safe">
        <Button 
          variant={location.startsWith('/washer/register') ? 'secondary' : 'ghost'} 
          className="flex-1 flex-col h-full rounded-none gap-1 py-2 text-muted-foreground hover:text-foreground data-[active=true]:text-primary"
          data-active={location.startsWith('/washer/register')}
          asChild
        >
          <Link href="/washer/register">
            <Droplets className="h-5 w-5" />
            <span className="text-[10px] font-medium">Queue</span>
          </Link>
        </Button>
        <Button 
          variant={location.startsWith('/washer/chat') ? 'secondary' : 'ghost'} 
          className="flex-1 flex-col h-full rounded-none gap-1 py-2 text-muted-foreground hover:text-foreground data-[active=true]:text-primary"
          data-active={location.startsWith('/washer/chat')}
          asChild
        >
          <Link href="/washer/chat">
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">Chat</span>
          </Link>
        </Button>
      </nav>
    </div>
  );
}
