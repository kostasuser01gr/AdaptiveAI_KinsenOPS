import { useState } from 'react';
import { useLocation } from 'wouter';
import { MessageSquare, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { WidgetProps } from './index';

export default function ChatSummaryWidget({ config: _config }: WidgetProps) {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      navigate('/');
      setMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
        <div className="text-center">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Ask DriveAI anything</p>
          <p className="text-[10px] mt-1">Fleet status, reports, commands</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="text-xs h-8"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleSend}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
