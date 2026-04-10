import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createWorker, Worker } from 'tesseract.js';
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, RotateCcw, Radio, Pause } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface PlateScannerProps {
  onPlateDetected: (plate: string) => void;
  sunMode?: boolean;
  /** If true, keep camera open after detection and enable auto-scan (kiosk always-on mode) */
  alwaysOn?: boolean;
}

const PLATE_REGEX = /[A-Z0-9]{2,4}[\s-]?[A-Z0-9]{2,5}/;
const AUTO_SCAN_INTERVAL = 2000;
const COOLDOWN_AFTER_DETECT = 4000;

function cleanPlateText(raw: string): string {
  return raw.replace(/[^A-Z0-9-]/gi, '').toUpperCase().slice(0, 10);
}

export default function PlateScanner({ onPlateDetected, sunMode, alwaysOn }: PlateScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDetectedRef = useRef('');
  const scanningRef = useRef(false);

  const [active, setActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [lastPlate, setLastPlate] = useState<string | null>(null);

  const stopAutoScan = useCallback(() => {
    if (autoScanTimer.current) { clearInterval(autoScanTimer.current); autoScanTimer.current = null; }
    setAutoScan(false);
  }, []);

  const stopCamera = useCallback(() => {
    stopAutoScan();
    if (cooldownTimer.current) { clearTimeout(cooldownTimer.current); cooldownTimer.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setActive(false);
    setCooldown(false);
    setLastPlate(null);
    lastDetectedRef.current = '';
  }, [stopAutoScan]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      if (!workerRef.current) {
        setWorkerLoading(true);
        createWorker('eng').then(async (w) => {
          await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ' });
          workerRef.current = w;
          setWorkerLoading(false);
        }).catch(() => setWorkerLoading(false));
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    };
  }, [stopCamera]);

  const runOCR = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const { data } = await workerRef.current.recognize(canvas);
    const raw = data.text.trim();
    if (!raw) return null;
    const match = raw.match(PLATE_REGEX);
    const plate = match ? cleanPlateText(match[0]) : cleanPlateText(raw);
    return plate.length >= 3 ? plate : null;
  }, []);

  const handleDetection = useCallback((plate: string) => {
    setLastPlate(plate);
    lastDetectedRef.current = plate;
    onPlateDetected(plate);
    setCooldown(true);
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => {
      setCooldown(false);
      lastDetectedRef.current = '';
    }, COOLDOWN_AFTER_DETECT);
  }, [onPlateDetected]);

  const captureAndOCR = useCallback(async () => {
    if (scanningRef.current || cooldown) return;
    scanningRef.current = true;
    setScanning(true);
    setError(null);
    try {
      if (!workerRef.current) {
        workerRef.current = await createWorker('eng');
        await workerRef.current.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ' });
      }
      const plate = await runOCR();
      if (plate) {
        handleDetection(plate);
        if (!alwaysOn) stopCamera();
      } else {
        setError('No plate detected. Try adjusting the angle.');
      }
    } catch {
      setError('OCR failed. Try again.');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [cooldown, runOCR, handleDetection, alwaysOn, stopCamera]);

  const startAutoScan = useCallback(() => {
    if (!workerRef.current || workerLoading) return;
    setAutoScan(true);
    autoScanTimer.current = setInterval(async () => {
      if (scanningRef.current || cooldown || !workerRef.current) return;
      scanningRef.current = true;
      setScanning(true);
      try {
        const plate = await runOCR();
        if (plate && plate !== lastDetectedRef.current) handleDetection(plate);
      } catch { /* swallow in auto-scan */ }
      finally { scanningRef.current = false; setScanning(false); }
    }, AUTO_SCAN_INTERVAL);
  }, [workerLoading, cooldown, runOCR, handleDetection]);

  if (!active) {
    return (
      <Button
        variant="outline"
        className={`w-full gap-2 ${sunMode ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : ''}`}
        onClick={startCamera}
        data-testid="button-scan-plate"
      >
        <Camera className="h-4 w-4" /> Scan Plate with Camera
      </Button>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${sunMode ? 'border-gray-300' : 'border-border'}`}>
      <div className="relative">
        <video ref={videoRef} className="w-full h-48 object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`border-2 border-dashed rounded-lg w-[70%] h-12 transition-colors ${cooldown ? 'border-green-400/80' : scanning ? 'border-yellow-400/80' : 'border-white/60'}`} />
        </div>
        {autoScan && (
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className="bg-black/50 text-white border-none text-[10px] gap-1">
              <Radio className={`h-3 w-3 ${cooldown ? 'text-green-400' : 'text-red-400 animate-pulse'}`} />
              {cooldown ? 'Cooldown' : 'Auto-Scanning'}
            </Badge>
          </div>
        )}
        {lastPlate && (
          <div className="absolute bottom-2 left-2">
            <Badge className="bg-green-600 text-white text-xs font-mono">{lastPlate}</Badge>
          </div>
        )}
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 bg-black/40 text-white hover:bg-black/60" onClick={stopCamera}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-2 space-y-2">
        {error && (
          <p className={`text-xs px-2 py-1 rounded ${sunMode ? 'bg-red-50 text-red-600' : 'bg-red-500/10 text-red-400'}`}>{error}</p>
        )}
        <div className="flex gap-2">
          <Button
            onClick={captureAndOCR}
            disabled={scanning || workerLoading || cooldown}
            className={`flex-1 gap-2 ${sunMode ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
            data-testid="button-capture-plate"
          >
            {scanning || workerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {workerLoading ? 'Loading OCR...' : scanning ? 'Reading...' : cooldown ? 'Detected!' : 'Capture & Read'}
          </Button>
          {alwaysOn && (
            <Button
              variant={autoScan ? "destructive" : "outline"}
              className={`gap-1.5 ${!autoScan && sunMode ? 'bg-white border-gray-300' : ''}`}
              onClick={() => autoScan ? stopAutoScan() : startAutoScan()}
              disabled={workerLoading}
              data-testid="button-auto-scan"
            >
              {autoScan ? <Pause className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
              {autoScan ? 'Stop' : 'Auto'}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={startCamera} className={sunMode ? 'bg-white border-gray-300' : ''}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
