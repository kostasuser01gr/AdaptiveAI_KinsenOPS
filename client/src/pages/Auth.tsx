import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Car, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginValues = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(100),
  username: z.string().min(2, "Username must be at least 2 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
  inviteToken: z.string().min(1, "Invite token is required"),
});
type RegisterValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { login, register, loginError, registerError } = useAuth();

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', password: '', displayName: '', inviteToken: '' },
  });

  const handleLogin = async (values: LoginValues) => {
    try {
      await login(values);
    } catch (_err) {/* no-op */}
  };

  const handleRegister = async (values: RegisterValues) => {
    try {
      await register(values);
    } catch (_err) {/* no-op */}
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Car className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DriveAI</h1>
            <p className="text-sm text-muted-foreground">Workspace</p>
          </div>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Sign in to access your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField control={loginForm.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl><Input {...field} data-testid="input-login-username" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={loginForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl><Input type="password" {...field} data-testid="input-login-password" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {loginError && (
                      <p className="text-sm text-destructive" data-testid="text-login-error">
                        {(loginError as Error).message?.includes("401") ? "Invalid username or password" : "Login failed"}
                      </p>
                    )}
                    <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting} data-testid="button-login">
                      {loginForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Sign In
                    </Button>
                    {import.meta.env.DEV && (
                      <p className="text-xs text-center text-muted-foreground">
                        Dev: admin / admin123
                      </p>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>Join your team's workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <FormField control={registerForm.control} name="displayName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl><Input {...field} data-testid="input-reg-displayname" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={registerForm.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl><Input {...field} data-testid="input-reg-username" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={registerForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl><Input type="password" {...field} data-testid="input-reg-password" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={registerForm.control} name="inviteToken" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invite Token</FormLabel>
                        <FormControl><Input {...field} placeholder="Paste your invite token" data-testid="input-reg-invite" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {registerError && (
                      <p className="text-sm text-destructive" data-testid="text-register-error">
                        {(registerError as Error).message?.includes("409") ? "Username already taken"
                          : (registerError as Error).message?.includes("403") ? "Invalid or expired invite token"
                          : "Registration failed"}
                      </p>
                    )}
                    <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting} data-testid="button-register">
                      {registerForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Create Account
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
