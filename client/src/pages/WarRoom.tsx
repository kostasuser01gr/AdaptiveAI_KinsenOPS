import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { MessageSquare, Users, Car, Clock, AlertTriangle, Send, Bot, Plus, Shield, Zap, Eye, CheckSquare, FileText, ArrowRight, ListTodo, Bell, Bookmark } from 'lucide-react';
import { useAuth } from "@/lib/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function WarRoomPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: rooms } = useQuery({ queryKey: ["/api/entity-rooms"] });
  const allRooms = Array.isArray(rooms) ? rooms : [];
  const [selectedRoom, setSelectedRoom] = React.useState<number | null>(null);
  const [msgInput, setMsgInput] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newType, setNewType] = React.useState('operations');
  const [newPriority, setNewPriority] = React.useState('normal');
  const [activePanel, setActivePanel] = React.useState<string | null>(null);

  const { data: messages } = useQuery({
    queryKey: ["/api/entity-rooms", selectedRoom, "messages"],
    queryFn: async () => { const res = await fetch(`/api/entity-rooms/${selectedRoom}/messages`, { credentials: 'include' }); return res.json(); },
    enabled: !!selectedRoom,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => { await apiRequest("POST", `/api/entity-rooms/${selectedRoom}/messages`, { content, role: "user", type: "message" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/entity-rooms", selectedRoom, "messages"] }); setMsgInput(''); },
  });

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/entity-rooms", { entityType: newType, entityId: `${newType}-${Date.now()}`, title: newTitle, status: "open", priority: newPriority });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/entity-rooms"] }); setShowCreate(false); setNewTitle(''); },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { await apiRequest("PATCH", `/api/entity-rooms/${id}`, data); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/entity-rooms"] }),
  });

  const allMessages = Array.isArray(messages) ? messages : [];
  const currentRoom = allRooms.find((r: any) => r.id === selectedRoom);
  const crisisRooms = allRooms.filter((r: any) => r.priority === 'critical');
  const entityIcons: Record<string, any> = { vehicle: Car, shift: Clock, operations: Users, incident: AlertTriangle, import: FileText, customer: Shield };

  const convertToAction = (msg: any) => {
    sendMutation.mutate(`[TASK CREATED] From message: "${msg.content.substring(0, 60)}..." — Assigned for review.`);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-5 w-5 text-primary" /> War Room & Collaboration
          </h1>
          <p className="text-sm text-muted-foreground">Entity rooms, crisis mode, tasks, AI summaries, real-time coordination</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-room"><Plus className="h-4 w-4" /> New Room</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Collaboration Room</DialogTitle>
              <DialogDescription>Create a room for any entity — vehicle, shift, incident, or operation.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Room title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} data-testid="input-room-title" />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="shift">Shift Planning</SelectItem>
                    <SelectItem value="incident">Incident</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                    <SelectItem value="customer">Customer Issue</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical (Crisis)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!newTitle.trim()} onClick={() => createRoomMutation.mutate()} data-testid="button-save-room">Create Room</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r flex flex-col">
          <Tabs defaultValue="all" className="flex flex-col h-full">
            <TabsList className="mx-3 mt-3 mb-2">
              <TabsTrigger value="all" className="text-xs" data-testid="tab-all-rooms">All ({allRooms.length})</TabsTrigger>
              <TabsTrigger value="crisis" className="text-xs" data-testid="tab-crisis">Crisis ({crisisRooms.length})</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1 px-3">
              <TabsContent value="all" className="mt-0 space-y-1">
                {allRooms.map((room: any) => {
                  const Icon = entityIcons[room.entityType] || MessageSquare;
                  return (
                    <button key={room.id} onClick={() => { setSelectedRoom(room.id); setActivePanel(null); }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${selectedRoom === room.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}
                      data-testid={`room-item-${room.id}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium truncate flex-1">{room.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[8px] px-1 h-4">{room.entityType}</Badge>
                        {room.priority === 'critical' && <Badge variant="destructive" className="text-[8px] px-1 h-4">CRISIS</Badge>}
                        {room.priority === 'high' && <Badge className="text-[8px] px-1 h-4 bg-orange-500/20 text-orange-400">HIGH</Badge>}
                        <Badge variant="secondary" className="text-[8px] px-1 h-4 ml-auto">{room.status}</Badge>
                      </div>
                    </button>
                  );
                })}
              </TabsContent>
              <TabsContent value="crisis" className="mt-0 space-y-1">
                {crisisRooms.length === 0 ? (
                  <div className="p-6 text-center"><p className="text-xs text-muted-foreground">No active crises</p></div>
                ) : crisisRooms.map((room: any) => (
                  <button key={room.id} onClick={() => setSelectedRoom(room.id)}
                    className={`w-full text-left p-3 rounded-lg border-l-2 border-l-red-500 transition-colors ${selectedRoom === room.id ? 'bg-red-500/10' : 'hover:bg-muted/50'}`}
                    data-testid={`crisis-room-${room.id}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium">{room.title}</span>
                    </div>
                  </button>
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        <div className="flex-1 flex flex-col">
          {currentRoom ? (
            <>
              <div className="p-3 border-b flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm">{currentRoom.title}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[9px]">{currentRoom.entityType}:{currentRoom.entityId}</Badge>
                    {currentRoom.priority === 'critical' && <Badge variant="destructive" className="text-[9px]">CRISIS</Badge>}
                    {(currentRoom.metadata as any)?.sourceNotificationId && (
                      <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-500">
                        <Bell className="h-2 w-2 mr-1" /> Escalated from Inbox #{(currentRoom.metadata as any).sourceNotificationId}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {['timeline', 'tasks', 'watchers'].map(panel => (
                    <Button key={panel} variant={activePanel === panel ? 'default' : 'outline'} size="sm" className="h-7 text-[10px] capitalize"
                      onClick={() => setActivePanel(activePanel === panel ? null : panel)} data-testid={`button-room-${panel}`}>
                      {panel === 'timeline' && <Clock className="h-3 w-3 mr-1" />}
                      {panel === 'tasks' && <><ListTodo className="h-3 w-3 mr-1" />{allMessages.filter((m: any) => m.content?.startsWith('[TASK CREATED]')).length > 0 && <span className="ml-0.5">({allMessages.filter((m: any) => m.content?.startsWith('[TASK CREATED]')).length})</span>}</>}
                      {panel === 'watchers' && <><Eye className="h-3 w-3 mr-1" />{(() => { const unique = new Set(allMessages.map((m: any) => m.userId)); return unique.size > 0 ? `(${unique.size})` : ''; })()}</>}
                      {panel}
                    </Button>
                  ))}
                  {currentRoom.status === 'open' && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] text-green-400" onClick={() => updateRoomMutation.mutate({ id: currentRoom.id, data: { status: 'resolved' } })} data-testid="button-resolve-room">
                      <CheckSquare className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {allMessages.map((msg: any) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`} data-testid={`room-message-${msg.id}`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs ${msg.role === 'assistant' ? 'bg-primary/20' : 'bg-muted'}`}>
                          {msg.role === 'assistant' ? <Bot className="h-3.5 w-3.5 text-primary" /> : <Users className="h-3.5 w-3.5" />}
                        </div>
                        <div className="group relative">
                          <div className={`px-3 py-2 rounded-2xl max-w-[70%] text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {msg.content}
                          </div>
                          <div className="absolute -bottom-5 left-0 hidden group-hover:flex gap-1">
                            <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" onClick={() => convertToAction(msg)} data-testid={`button-to-task-${msg.id}`}>
                              <ArrowRight className="h-2 w-2 mr-0.5" /> Task
                            </Button>
                            <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5" data-testid={`button-bookmark-${msg.id}`}>
                              <Bookmark className="h-2 w-2 mr-0.5" /> Pin
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {allMessages.length === 0 && (
                      <div className="text-center py-12">
                        <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <p className="text-sm text-muted-foreground">No messages yet. Start the discussion or ask AI for a summary.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {activePanel && (
                  <div className="w-64 border-l p-3">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1">
                      {activePanel === 'timeline' && <><Clock className="h-3 w-3" /> Timeline</>}
                      {activePanel === 'tasks' && <><ListTodo className="h-3 w-3" /> Tasks</>}
                      {activePanel === 'watchers' && <><Eye className="h-3 w-3" /> Watchers</>}
                    </h3>
                    {activePanel === 'timeline' && (
                      <div className="space-y-2">
                        <div className="text-[10px] text-muted-foreground border-l-2 border-primary pl-2 py-1">
                          Room created
                          <span className="block text-[9px]">{currentRoom.createdAt ? new Date(currentRoom.createdAt).toLocaleString() : ''}</span>
                        </div>
                        {allMessages.map((m: any, i: number) => (
                          <div key={i} className={`text-[10px] text-muted-foreground border-l-2 pl-2 py-1 ${m.content?.startsWith('[TASK') ? 'border-yellow-400' : 'border-border'}`}>
                            <span className="font-medium">{m.role === 'user' ? 'Staff' : m.role === 'system' ? 'System' : 'AI'}</span>: {m.content?.substring(0, 60)}{m.content?.length > 60 ? '...' : ''}
                            <span className="block text-[9px]">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
                          </div>
                        ))}
                        {allMessages.length === 0 && <p className="text-[10px] text-muted-foreground">No activity yet</p>}
                      </div>
                    )}
                    {activePanel === 'tasks' && (
                      <div className="space-y-2">
                        {(() => {
                          const tasks = allMessages.filter((m: any) => m.content?.startsWith('[TASK CREATED]'));
                          if (tasks.length === 0) return (
                            <>
                              <p className="text-xs text-muted-foreground">No tasks created yet.</p>
                              <p className="text-[10px] text-muted-foreground">Hover over any message and click "Task" to create one.</p>
                            </>
                          );
                          return tasks.map((t: any, i: number) => (
                            <div key={i} className="p-2 rounded border bg-muted/20 text-xs" data-testid={`task-item-${i}`}>
                              <div className="flex items-center gap-1 mb-1">
                                <CheckSquare className="h-3 w-3 text-primary" />
                                <span className="font-medium">Task #{i + 1}</span>
                              </div>
                              <p className="text-muted-foreground">{t.content.replace('[TASK CREATED] ', '').substring(0, 80)}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">{new Date(t.createdAt).toLocaleString()}</p>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                    {activePanel === 'watchers' && (
                      <div className="space-y-2">
                        {(() => {
                          const participants = new Map<number, { userId: number; role: string; count: number }>();
                          allMessages.forEach((m: any) => {
                            if (!participants.has(m.userId)) {
                              participants.set(m.userId, { userId: m.userId, role: m.role, count: 0 });
                            }
                            participants.get(m.userId)!.count++;
                          });
                          // Always include current user
                          if (user && !participants.has(user.id)) {
                            participants.set(user.id, { userId: user.id, role: user.role, count: 0 });
                          }
                          return Array.from(participants.values()).map((p, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                                {p.userId === user?.id ? user?.displayName?.charAt(0) : '#'}
                              </div>
                              <div className="flex-1">
                                <span className="text-xs">{p.userId === user?.id ? user?.displayName : `User #${p.userId}`}</span>
                                <span className="text-[9px] text-muted-foreground block">{p.count} message(s)</span>
                              </div>
                              <Badge variant="outline" className="text-[8px]">{p.role}</Badge>
                            </div>
                          ));
                        })()}
                        <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" data-testid="button-add-watcher"><Plus className="h-3 w-3 mr-1" /> Add Watcher</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && msgInput.trim() && sendMutation.mutate(msgInput)}
                    placeholder="Message, ask AI for summary, or convert to action..." className="flex-1 h-9 text-sm" data-testid="input-room-message" />
                  <Button size="sm" onClick={() => msgInput.trim() && sendMutation.mutate(msgInput)} disabled={!msgInput.trim()} data-testid="button-send-room-message">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                <h3 className="font-semibold mb-1">Select a Room</h3>
                <p className="text-sm text-muted-foreground mb-4">Choose an entity room or create a new one to start collaborating.</p>
                <Button onClick={() => setShowCreate(true)} variant="outline" data-testid="button-create-first-room">
                  <Plus className="h-4 w-4 mr-2" /> Create Room
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
