import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users as UsersIcon, Shield, MoreHorizontal, UserPlus, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/useAuth';

const ROLES = ["admin", "coordinator", "supervisor", "agent"] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  coordinator: "Coordinator",
  supervisor: "Supervisor",
  agent: "Agent",
};

function UserSkeleton() {
  return (
    <TableRow>
      <TableCell><div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></div></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  );
}

export default function UsersPage() {
  const { t, sidebarOpen, isMobile } = useApp();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [roleDialogUser, setRoleDialogUser] = useState<{ id: number; displayName: string; role: string } | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; displayName: string } | null>(null);

  const { data: users = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, { role });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role updated", description: `Role changed to ${ROLE_LABELS[vars.role]}` });
      setRoleDialogUser(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update role.", variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User removed", description: `${deleteTarget?.displayName} has been removed.` });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to remove user.", variant: "destructive" }),
  });

  const activeCount = users.filter((u: any) => u.id !== undefined).length;
  const roleSet = new Set(users.map((u: any) => u.role));

  const handleRoleChange = () => {
    if (!roleDialogUser || !selectedRole) return;
    updateRoleMutation.mutate({ id: roleDialogUser.id, role: selectedRole });
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <header className={`sticky top-0 z-10 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-sm border-b transition-all ${isMobile ? 'pl-14' : (sidebarOpen ? '' : 'pl-14')}`}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{t('users')}</h1>
        </div>
        <Button size="sm" className="gap-2" disabled>
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4 md:p-6 lg:px-24">
        <div className="max-w-5xl mx-auto space-y-8 pb-12">

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12" /> : activeCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12" /> : roleSet.size}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-12" /> : new Set(users.filter((u: any) => u.station).map((u: any) => u.station)).size}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Workspace Members</CardTitle>
              <CardDescription>Manage who has access to the DriveAI workspace and their permissions.</CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="flex items-center gap-2 text-destructive text-sm py-4">
                  <AlertCircle className="h-4 w-4" />
                  Failed to load users. Please refresh.
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => <UserSkeleton key={i} />)
                      ) : users.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <span className="text-xs font-medium">{user.displayName?.charAt(0) ?? '?'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{user.displayName}</span>
                                <span className="text-xs text-muted-foreground">@{user.username}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {user.role === 'admin' && <Shield className="h-3 w-3 text-primary" />}
                              <span className="text-sm">{ROLE_LABELS[user.role] ?? user.role}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground font-mono">{user.station ?? '—'}</span>
                          </TableCell>
                          <TableCell>
                            {currentUser?.id !== user.id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="User actions">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setRoleDialogUser(user); setSelectedRole(user.role); }}>
                                    Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteTarget({ id: user.id, displayName: user.displayName })}
                                  >
                                    Remove User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </ScrollArea>

      {/* Role change dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update the role for {roleDialogUser?.displayName}</DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogUser(null)}>Cancel</Button>
            <Button onClick={handleRoleChange} disabled={updateRoleMutation.isPending || selectedRole === roleDialogUser?.role}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.displayName}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
              disabled={deleteUserMutation.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
