import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Car, QrCode, Shield, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function CustomerEntry() {
  const [resNumber, setResNumber] = useState('');
  const [, setLocation] = useLocation();

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (resNumber.trim()) {
      setLocation(`/customer/res/${resNumber.toUpperCase()}/upload`);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
          <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center mb-2 shadow-lg shadow-primary/20">
            <Car className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-portal-title">DriveAI Client Portal</h1>
          <p className="text-muted-foreground text-sm">Securely document your vehicle condition and access your reservation.</p>
        </div>

        <Card className="glass-panel border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Enter Reservation</CardTitle>
            <CardDescription>Scan the QR code on your rental agreement or enter the reservation number manually.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEnter} className="space-y-4">
              <Input
                placeholder="e.g. RES-99821"
                value={resNumber}
                onChange={(e) => setResNumber(e.target.value)}
                className="h-12 text-lg uppercase text-center font-mono tracking-wider"
                data-testid="input-reservation"
              />
              <Button type="submit" className="w-full h-12 text-lg font-medium" disabled={!resNumber.trim()} data-testid="button-access-portal">
                Access Portal
              </Button>
              <Button type="button" variant="outline" className="w-full h-12 gap-2" data-testid="button-scan-qr">
                <QrCode className="h-5 w-5" /> Scan QR Code
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium">Privacy Protected</p>
              <p className="text-[10px] text-muted-foreground">Photos encrypted & auto-deleted after rental</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium">Takes 3-5 Minutes</p>
              <p className="text-[10px] text-muted-foreground">Guided step-by-step photo capture</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium">Instant Confirmation</p>
              <p className="text-[10px] text-muted-foreground">Receipt with reference code for your records</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          By continuing, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
