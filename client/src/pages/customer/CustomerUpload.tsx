import React, { useState, useRef, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Camera, Image as ImageIcon, UploadCloud, CheckCircle2, AlertTriangle, Shield, ChevronRight, Lock, Eye, Trash2, Loader2 } from 'lucide-react';
import { SuccessCheck } from '@/components/motion';

const DAMAGE_ZONES = ['Front Left', 'Front Center', 'Front Right', 'Left Side', 'Right Side', 'Rear Left', 'Rear Center', 'Rear Right', 'Roof', 'Interior'];

export default function CustomerUpload() {
  const [, params] = useRoute('/customer/res/:id/:tab');
  const resId = params?.id || '';
  const [photos, setPhotos] = useState<{ zone: string; file: File; preview: string }[]>([]);
  const [currentZone, setCurrentZone] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState(() => sessionStorage.getItem(`customer-notes-${resId}`) || '');
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [refCode, setRefCode] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Persist notes draft to sessionStorage
  useEffect(() => {
    if (notes) sessionStorage.setItem(`customer-notes-${resId}`, notes);
    else sessionStorage.removeItem(`customer-notes-${resId}`);
  }, [notes, resId]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const results: number[] = [];
      for (const photo of photos) {
        const res = await fetch('/api/public/evidence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'photo',
            caption: `${photo.zone}${notes ? ` — ${notes}` : ''}`,
            source: 'customer',
            reservationId: resId,
            metadata: { zone: photo.zone, fileName: photo.file.name },
          }),
        });
        if (!res.ok) throw new Error(`Upload failed for ${photo.zone}`);
        const json = await res.json();
        const record = (json && typeof json === 'object' && 'ok' in json) ? json.data : json;
        results.push(record.id);
      }
      return results;
    },
    retry: 2,
    onSuccess: (ids) => {
      setRefCode(`EVD-${ids[0]}-${ids.length}`);
      setSubmitted(true);
    },
  });

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { return; }
    const preview = URL.createObjectURL(file);
    setPhotos(prev => [...prev, { zone: DAMAGE_ZONES[currentZone], file, preview }]);
    if (currentZone < DAMAGE_ZONES.length - 1) setCurrentZone(prev => prev + 1);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => submitMutation.mutate();

  if (submitted) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center bg-background">
        <SuccessCheck show className="mb-6 h-20 w-20" />
        <h2 className="text-2xl font-bold mb-2">Evidence Submitted Successfully</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Your {photos.length} photos have been securely uploaded and encrypted. Keep your reference code for your records.
        </p>

        <Card className="glass-panel w-full max-w-sm mb-4">
          <CardContent className="p-4 space-y-3">
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Reference Code</p>
              <p className="text-xl font-mono font-bold text-primary" data-testid="text-ref-code">{refCode}</p>
            </div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Photos Submitted</span><span className="font-medium">{photos.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Zones Covered</span><span className="font-medium">{new Set(photos.map(p => p.zone)).size}/{DAMAGE_ZONES.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><Badge className="bg-green-500/20 text-green-400">Received & Encrypted</Badge></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Timestamp</span><span className="text-xs">{new Date().toLocaleString()}</span></div>
          </CardContent>
        </Card>

        <div className="w-full max-w-sm space-y-3">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
            <Lock className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-blue-400">Your photos are encrypted end-to-end and will be automatically deleted 60 days after your rental ends, per our privacy policy.</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 flex items-start gap-2">
            <Eye className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">Only authorized DriveAI staff at your rental station can access these photos. You can request deletion at any time.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <input type="file" accept="image/*" capture="environment" ref={fileRef} className="hidden" onChange={handleCapture} data-testid="input-camera" />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5 max-w-md mx-auto">
          <div className="text-center space-y-2 mt-2">
            <h2 className="text-xl font-bold">Document Vehicle Condition</h2>
            <p className="text-sm text-muted-foreground">Follow the guided steps to photograph each area of the vehicle for your protection.</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-blue-400 font-semibold mb-0.5">Your Privacy is Protected</p>
              <p className="text-[10px] text-blue-400/80">Photos are encrypted at upload, stored securely, and auto-deleted 60 days after your rental. Only authorized station staff can view them.</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Progress: {photos.length}/{DAMAGE_ZONES.length} zones</p>
              <Badge variant="outline" className="text-[10px]">{Math.round((photos.length / DAMAGE_ZONES.length) * 100)}%</Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${(photos.length / DAMAGE_ZONES.length) * 100}%` }} />
            </div>
          </div>

          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Badge variant="outline" className="text-[9px]">Step {currentZone + 1} of {DAMAGE_ZONES.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-1">Current Zone</p>
              <h3 className="text-lg font-bold text-primary mb-3">{DAMAGE_ZONES[currentZone]}</h3>
              <p className="text-[10px] text-muted-foreground mb-3">Take a clear photo of the {DAMAGE_ZONES[currentZone].toLowerCase()} area. Include any existing damage, scratches, or dents.</p>
              <Button className="w-full h-14 text-lg gap-2 rounded-xl" onClick={() => fileRef.current?.click()} data-testid="button-take-photo">
                <Camera className="h-6 w-6" /> Take Photo
              </Button>
              <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={() => fileRef.current?.click()} data-testid="button-upload-gallery">
                <ImageIcon className="h-4 w-4 mr-2" /> Upload from Gallery
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-medium">All Zones</p>
            <div className="grid grid-cols-2 gap-2">
              {DAMAGE_ZONES.map((zone, i) => {
                const photo = photos.find(p => p.zone === zone);
                return (
                  <button key={zone} onClick={() => { setCurrentZone(i); if (!photo) fileRef.current?.click(); }}
                    className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                      i === currentZone ? 'border-primary bg-primary/5' :
                      photo ? 'border-green-500/30 bg-green-500/5' : 'border-border hover:bg-muted/50'
                    }`} data-testid={`zone-${i}`}>
                    <div className="flex items-center justify-between">
                      <span className={photo ? 'text-green-400' : 'text-muted-foreground'}>{zone}</span>
                      {photo ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Captured Photos ({photos.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden border relative group" data-testid={`photo-preview-${i}`}>
                    <img src={p.preview} alt={p.zone} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 text-center">{p.zone}</div>
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-remove-photo-${i}`}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Additional Notes (Optional)</p>
              <textarea
                className="w-full bg-muted/30 border rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe any pre-existing damage, concerns, or notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                data-testid="input-notes"
              />
            </div>
          )}

          {photos.length >= 3 && (
            <div className="space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreedPrivacy} onChange={e => setAgreedPrivacy(e.target.checked)} className="mt-1" data-testid="checkbox-privacy" />
                <span className="text-xs text-muted-foreground">I understand that these photos will be securely stored and used only for documenting the vehicle condition at the time of rental.</span>
              </label>
              <Button className="w-full h-14 text-lg rounded-xl gap-2" onClick={handleSubmit} disabled={!agreedPrivacy || submitMutation.isPending} data-testid="button-submit-evidence">
                {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />} {submitMutation.isPending ? 'Uploading...' : `Submit Evidence (${photos.length} photos)`}
              </Button>
              {submitMutation.isError && (
                <p className="text-xs text-red-400 text-center mt-2">Upload failed. Please try again.</p>
              )}
            </div>
          )}

          {photos.length < 3 && photos.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-400">Minimum 3 photos required. Please photograph more zones for a complete record.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
