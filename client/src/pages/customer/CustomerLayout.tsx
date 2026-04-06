import React from 'react';
import { Link, useLocation } from 'wouter';
import { Camera, MessageSquare, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CustomerLayout({ children, params }: { children: React.ReactNode, params: { id: string } }) {
  const [location] = useLocation();
  const resId = params.id;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">
      <header className="h-14 bg-background/95 backdrop-blur border-b flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Res: {resId}</span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative pb-[60px]">
        {children}
      </main>
      
      <nav className="fixed bottom-0 left-0 w-full h-[60px] bg-background/95 backdrop-blur border-t flex items-center justify-around px-4 z-50 pb-safe">
        <Button 
          variant={location.includes('/upload') ? 'secondary' : 'ghost'} 
          className="flex-1 flex-col h-full rounded-none gap-1 py-2 text-muted-foreground hover:text-foreground data-[active=true]:text-primary"
          data-active={location.includes('/upload')}
          asChild
        >
          <Link href={`/customer/res/${resId}/upload`}>
            <Camera className="h-5 w-5" />
            <span className="text-[10px] font-medium">Photos</span>
          </Link>
        </Button>
        <Button 
          variant={location.includes('/chat') ? 'secondary' : 'ghost'} 
          className="flex-1 flex-col h-full rounded-none gap-1 py-2 text-muted-foreground hover:text-foreground data-[active=true]:text-primary"
          data-active={location.includes('/chat')}
          asChild
        >
          <Link href={`/customer/res/${resId}/chat`}>
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">Support</span>
          </Link>
        </Button>
      </nav>
    </div>
  );
}
