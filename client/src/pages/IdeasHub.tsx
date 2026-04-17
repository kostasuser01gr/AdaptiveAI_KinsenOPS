import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useAuth } from '@/lib/useAuth';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MotionDialog } from '@/components/motion/MotionDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Empty, EmptyContent, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import {
  Lightbulb, Plus, MessageSquare, ArrowUp, Filter, Clock, CheckCircle2, XCircle,
  Sparkles, Wrench, Layers, Workflow, Puzzle, Bug
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const statusStyles: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  proposed: { color: 'bg-blue-500/10 text-blue-600', icon: <Clock className="h-3 w-3" />, label: 'Proposed' },
  approved: { color: 'bg-emerald-500/10 text-emerald-600', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Approved' },
  applied: { color: 'bg-purple-500/10 text-purple-600', icon: <Sparkles className="h-3 w-3" />, label: 'Applied' },
  rejected: { color: 'bg-red-500/10 text-red-600', icon: <XCircle className="h-3 w-3" />, label: 'Rejected' },
  reverted: { color: 'bg-slate-500/10 text-slate-600', icon: <XCircle className="h-3 w-3" />, label: 'Reverted' },
};

const categoryIcons: Record<string, React.ReactNode> = {
  general: <Lightbulb className="h-4 w-4" />,
  feature: <Sparkles className="h-4 w-4" />,
  ui: <Layers className="h-4 w-4" />,
  workflow: <Workflow className="h-4 w-4" />,
  integration: <Puzzle className="h-4 w-4" />,
  bug: <Bug className="h-4 w-4" />,
};

const categories = ['general', 'feature', 'ui', 'workflow', 'integration', 'bug'];

export default function IdeasHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIdea, setSelectedIdea] = useState<any>(null);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Form state
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  const { data: ideas = [] } = useQuery<any[]>({
    queryKey: ['/api/ideas'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: [`/api/ideas/${selectedIdea?.id}/comments`],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!selectedIdea,
  });

  const createIdea = useMutation({
    mutationFn: (data: { label: string; description: string; category: string; type: string }) =>
      apiRequest('POST', '/api/workspace-proposals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/ideas'] });
      setShowNewIdea(false);
      setNewLabel('');
      setNewDescription('');
      setNewCategory('general');
      toast({ title: 'Idea submitted!' });
    },
  });

  const addComment = useMutation({
    mutationFn: (data: { content: string }) =>
      apiRequest('POST', `/api/ideas/${selectedIdea?.id}/comments`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/ideas/${selectedIdea?.id}/comments`] });
      setNewComment('');
    },
  });

  const filtered = ideas.filter((i: any) => {
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    return true;
  });

  return (
    <PageShell title="Ideas Hub" icon={<Lightbulb className="h-5 w-5" />} subtitle="Propose ideas, share feedback, collaborate">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>
                <span className="capitalize">{c}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusStyles).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowNewIdea(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Idea
            </Button>
        <MotionDialog open={showNewIdea} onOpenChange={setShowNewIdea} title="Submit an Idea">
            <div className="space-y-4">
              <Input
                placeholder="What's your idea?"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
              />
              <Textarea
                placeholder="Describe your idea in detail..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                rows={4}
              />
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <Button
                      key={c}
                      variant={newCategory === c ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5 text-xs capitalize"
                      onClick={() => setNewCategory(c)}
                    >
                      {categoryIcons[c]}
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => createIdea.mutate({ label: newLabel, description: newDescription, category: newCategory, type: 'idea' })}
                disabled={!newLabel.trim()}
              >
                Submit Idea
              </Button>
            </div>
        </MotionDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Idea Cards Feed */}
        <ScrollArea className="col-span-1 lg:col-span-2 h-[calc(100vh-240px)]">
          <div className="space-y-3 pr-2">
            {filtered.length === 0 && (
              <Empty>
                <EmptyContent>
                  <EmptyMedia variant="icon"><Lightbulb className="h-10 w-10" /></EmptyMedia>
                  <EmptyTitle>No ideas yet</EmptyTitle>
                  <EmptyDescription>Be the first to share an idea!</EmptyDescription>
                </EmptyContent>
              </Empty>
            )}
            {filtered.map((idea: any) => {
              const st = statusStyles[idea.status] || statusStyles.proposed;
              return (
                <Card
                  key={idea.id}
                  className={`cursor-pointer transition-colors hover:border-primary/40 ${selectedIdea?.id === idea.id ? 'border-primary' : ''}`}
                  onClick={() => setSelectedIdea(idea)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">{categoryIcons[idea.category] || categoryIcons.general}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{idea.label}</span>
                          <Badge className={`text-[10px] ${st.color}`}>
                            {st.icon}
                            <span className="ml-1">{st.label}</span>
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{idea.category}</Badge>
                        </div>
                        {idea.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{idea.proposedBy ? `by ${idea.proposedBy}` : ''}</span>
                          <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        {/* Detail/Comments Panel */}
        <div className="col-span-1 h-[calc(100vh-240px)]">
          {selectedIdea ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-2">
                  {categoryIcons[selectedIdea.category] || categoryIcons.general}
                  <div className="flex-1">
                    <CardTitle className="text-base">{selectedIdea.label}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-[10px] ${statusStyles[selectedIdea.status]?.color || ''}`}>
                        {statusStyles[selectedIdea.status]?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <ScrollArea className="flex-1 p-4">
                {selectedIdea.description && (
                  <p className="text-sm mb-4">{selectedIdea.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{comments.length} comments</span>
                </div>
                <div className="space-y-3">
                  {comments.map((c: any) => (
                    <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">User #{c.userId}</span>
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm mt-1">{c.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Separator />
              <div className="p-3 flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="text-sm"
                  onKeyDown={e => e.key === 'Enter' && newComment.trim() && addComment.mutate({ content: newComment })}
                />
                <Button
                  size="sm"
                  disabled={!newComment.trim()}
                  onClick={() => addComment.mutate({ content: newComment })}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Select an idea to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
