import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Car, Building2, MapPin, Users, Plug, CheckCircle2, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: Sparkles },
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'stations', label: 'Stations', icon: MapPin },
  { id: 'fleet_size', label: 'Fleet', icon: Car },
  { id: 'roles', label: 'Roles', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'complete', label: 'Complete', icon: CheckCircle2 },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function SetupWizard() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState<StepId>('welcome');
  const [formData, setFormData] = useState<Record<string, any>>({
    companyName: '',
    industry: 'car_rental',
    stationCount: 1,
    stationNames: ['Main Station'],
    fleetSize: 10,
    roles: ['admin', 'coordinator', 'washer'],
    integrations: [] as string[],
  });

  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  const saveStep = useMutation({
    mutationFn: async (step: StepId) => {
      await apiRequest('POST', '/api/setup/step', { step, data: formData });
    }
  });

  const completeSetup = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/setup/complete', formData);
    },
    onSuccess: () => navigate('/'),
  });

  const next = () => {
    saveStep.mutate(currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const back = () => {
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const update = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = i === currentIndex;
            const isDone = i < currentIndex;
            return (
              <div key={step.id} className="flex items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-primary text-primary-foreground scale-110' : isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <StepIcon className="h-3.5 w-3.5" />
                </div>
                {i < STEPS.length - 1 && <div className={`w-6 h-0.5 mx-1 ${isDone ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            );
          })}
        </div>

        <Card className="glass-card">
          <CardContent className="p-6 space-y-6">
            {currentStep === 'welcome' && (
              <>
                <div className="text-center space-y-3">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Welcome to DriveAI</h2>
                  <p className="text-muted-foreground">Let's set up your workspace in under 2 minutes. You can always change these settings later.</p>
                </div>
              </>
            )}

            {currentStep === 'company' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">Your Company</h2>
                  <p className="text-sm text-muted-foreground">Tell us about your business.</p>
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={formData.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Acme Car Rentals" />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'car_rental', label: 'Car Rental' },
                      { value: 'fleet_management', label: 'Fleet Management' },
                      { value: 'car_wash', label: 'Car Wash' },
                      { value: 'logistics', label: 'Logistics' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        className={`p-3 rounded-lg border text-sm text-left transition-all ${formData.industry === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                        onClick={() => update('industry', opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'stations' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">Stations</h2>
                  <p className="text-sm text-muted-foreground">How many locations do you operate?</p>
                </div>
                <div className="space-y-2">
                  <Label>Number of Stations</Label>
                  <Input type="number" min={1} max={50} value={formData.stationCount} onChange={e => {
                    const count = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                    const names = Array.from({ length: count }, (_, i) => formData.stationNames?.[i] || `Station ${i + 1}`);
                    setFormData(prev => ({ ...prev, stationCount: count, stationNames: names }));
                  }} />
                </div>
                <div className="space-y-2">
                  {formData.stationNames?.slice(0, 5).map((name: string, i: number) => (
                    <Input key={i} value={name} placeholder={`Station ${i + 1}`} onChange={e => {
                      const names = [...formData.stationNames];
                      names[i] = e.target.value;
                      update('stationNames', names);
                    }} />
                  ))}
                  {formData.stationCount > 5 && <p className="text-xs text-muted-foreground">+{formData.stationCount - 5} more (edit in Settings later)</p>}
                </div>
              </div>
            )}

            {currentStep === 'fleet_size' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">Fleet Size</h2>
                  <p className="text-sm text-muted-foreground">Approximately how many vehicles?</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[10, 25, 50, 100, 250, 500].map(n => (
                    <button key={n}
                      className={`p-4 rounded-lg border text-center transition-all ${formData.fleetSize === n ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                      onClick={() => update('fleetSize', n)}
                    >
                      <p className="text-lg font-bold">{n}</p>
                      <p className="text-xs text-muted-foreground">vehicles</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 'roles' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">Team Roles</h2>
                  <p className="text-sm text-muted-foreground">Which roles will use the platform?</p>
                </div>
                <div className="space-y-2">
                  {['admin', 'coordinator', 'supervisor', 'agent', 'washer'].map(role => (
                    <label key={role} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      formData.roles.includes(role) ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                    }`}>
                      <input type="checkbox" className="sr-only" checked={formData.roles.includes(role)}
                        onChange={e => {
                          const roles = e.target.checked ? [...formData.roles, role] : formData.roles.filter((r: string) => r !== role);
                          update('roles', roles);
                        }}
                      />
                      <Badge variant={formData.roles.includes(role) ? 'default' : 'outline'} className="capitalize">{role}</Badge>
                      <span className="text-sm text-muted-foreground">{
                        { admin: 'Full system control', coordinator: 'Manage operations', supervisor: 'Oversee teams', agent: 'Customer-facing', washer: 'Vehicle cleaning' }[role]
                      }</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 'integrations' && (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold">Integrations</h2>
                  <p className="text-sm text-muted-foreground">Connect external services (optional, configure later).</p>
                </div>
                <div className="space-y-2">
                  {['telematics', 'accounting', 'crm', 'email'].map(integration => (
                    <label key={integration} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      formData.integrations.includes(integration) ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                    }`}>
                      <input type="checkbox" className="sr-only" checked={formData.integrations.includes(integration)}
                        onChange={e => {
                          const ints = e.target.checked
                            ? [...formData.integrations, integration]
                            : formData.integrations.filter((i: string) => i !== integration);
                          update('integrations', ints);
                        }}
                      />
                      <Plug className={`h-4 w-4 ${formData.integrations.includes(integration) ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm capitalize">{integration}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 'complete' && (
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold">You're All Set!</h2>
                <p className="text-muted-foreground">
                  Your workspace is configured for {formData.companyName || 'your company'} with {formData.stationCount} station(s) and ~{formData.fleetSize} vehicles.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              {currentIndex > 0 ? (
                <Button variant="outline" onClick={back} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : <div />}
              
              {currentStep === 'complete' ? (
                <Button onClick={() => completeSetup.mutate()} disabled={completeSetup.isPending} className="gap-1.5">
                  {completeSetup.isPending ? 'Setting up...' : 'Launch Dashboard'} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={next} className="gap-1.5">
                  {currentStep === 'welcome' ? "Let's Go" : 'Continue'} <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
