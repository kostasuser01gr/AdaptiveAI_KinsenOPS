import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquareWarning, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  { value: 'bug', label: 'Bug / Something broken' },
  { value: 'usability', label: 'Hard to use' },
  { value: 'data', label: 'Wrong / missing data' },
  { value: 'other', label: 'Other' },
] as const;

export default function FeedbackDialog() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/feedback', { page: location, category, message });
    },
    onSuccess: () => {
      toast({ title: 'Thanks!', description: 'Your feedback has been submitted.' });
      setCategory('');
      setMessage('');
      setOpen(false);
    },
    onError: () => {
      toast({ title: 'Could not submit', description: 'Please try again later.', variant: 'destructive' });
    },
  });

  if (!user) return null;

  const canSubmit = category && message.trim().length >= 5 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          data-testid="button-report-problem"
        >
          <MessageSquareWarning className="h-4 w-4" />
          Report a problem
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-feedback-category">
              <SelectValue placeholder="What kind of issue?" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Describe what happened…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            data-testid="textarea-feedback-message"
          />

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              size="sm"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
              data-testid="button-submit-feedback"
            >
              {mutation.isPending ? 'Sending…' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
