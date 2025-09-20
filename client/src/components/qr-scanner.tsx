import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QRCodeData {
  company: string;
  driverId: string;
  v: number;
}

export default function QRScanner({ isOpen, onClose }: QRScannerProps) {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  const [customDriverId, setCustomDriverId] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const checkCameraPermission = async () => {
    if (!navigator.permissions) {
      setPermissionStatus('unknown');
      return;
    }
    
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setPermissionStatus(result.state);
      return result.state;
    } catch (err) {
      setPermissionStatus('unknown');
      return 'unknown';
    }
  };

  const startScanning = async () => {
    try {
      setError("");
      setIsScanning(true);
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported on this device");
      }
      
      // Check current permission status
      await checkCameraPermission();
      
      // Request camera permissions explicitly
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setPermissionStatus('granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play();
          }
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      let errorMessage = "Unable to access camera.";
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings and try again.";
        setPermissionStatus('denied');
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No camera found on this device.";
      } else if (err.name === 'NotSupportedError') {
        errorMessage = "Camera not supported on this device.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Camera is being used by another application.";
      } else if (err.message === "Camera not supported on this device") {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    setError("");
    onClose();
  };

  const handleQRCodeDetected = (data: string) => {
    try {
      const qrData: QRCodeData = JSON.parse(data);
      
      // Validate QR code data structure
      if (!qrData.company || !qrData.driverId || !qrData.v) {
        throw new Error("Invalid QR code format");
      }
      
      // Validate company
      if (qrData.company !== "Yah Mobility LLC") {
        throw new Error("Invalid company QR code");
      }
      
      // Stop scanning and navigate to booking with driver info
      stopScanning();
      setLocation(`/booking?driverId=${encodeURIComponent(qrData.driverId)}&source=qr`);
      
    } catch (err) {
      setError("Invalid QR code. Please scan a valid driver QR code.");
    }
  };

  const testWithMockData = () => {
    const mockQRData: QRCodeData = {
      company: "Yah Mobility LLC",
      driverId: "9daf8924-e476-4707-8152-4c0e45680d7c",
      v: 1
    };
    
    handleQRCodeDetected(JSON.stringify(mockQRData));
  };

  const testWithCustomDriverId = (driverId: string) => {
    const mockQRData: QRCodeData = {
      company: "Yah Mobility LLC",
      driverId: driverId,
      v: 1
    };
    
    handleQRCodeDetected(JSON.stringify(mockQRData));
  };

  // Simple QR code detection using canvas (basic implementation)
  const detectQRCode = () => {
    if (!videoRef.current || !isScanning) return;
    
    // This is a simplified implementation
    // In a real app, you'd use a proper QR code detection library
    // For now, we'll simulate detection after a delay
    setTimeout(() => {
      // Simulate QR code detection for testing
      // Replace this with actual QR detection logic
      const mockQRData = {
        company: "Yah Mobility LLC",
        driverId: "9daf8924-e476-4707-8152-4c0e45680d7c",
        v: 1
      };
      
      // Only simulate if we're still scanning
      if (isScanning) {
        handleQRCodeDetected(JSON.stringify(mockQRData));
      }
    }, 3000);
  };

  // Auto-start scanning when modal opens
  useEffect(() => {
    if (isOpen) {
      // Detect development mode
      const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setIsDevelopmentMode(isDev);
      
      // Check permissions first, then start scanning
      const initializeScanner = async () => {
        await checkCameraPermission();
        // Small delay to ensure modal is fully rendered
        setTimeout(() => {
          if (!isDev) {
            startScanning();
          }
        }, 100);
      };
      
      initializeScanner();
    } else {
      // Stop scanning when modal closes
      stopScanning();
      setError("");
      setPermissionStatus('unknown');
      setIsDevelopmentMode(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-yah-gold/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-yah-gold text-center">
            {isDevelopmentMode ? (
              <div className="flex items-center justify-center space-x-2">
                <span>Scan Driver QR Code</span>
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  DEV
                </span>
              </div>
            ) : (
              "Scan Driver QR Code"
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Camera Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={detectQRCode}
            />
            
            {/* Scanning Overlay */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-yah-gold border-dashed rounded-lg flex items-center justify-center">
                  <div className="text-center text-white">
                    <i className="fas fa-qrcode text-4xl text-yah-gold mb-2"></i>
                    <p className="text-sm">Position QR code here</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Error Overlay */}
            {error && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-center text-white p-4">
                  <i className="fas fa-exclamation-triangle text-red-400 text-2xl mb-2"></i>
                  <p className="text-sm mb-3">{error}</p>
                  
                  {/* Permission-specific actions */}
                  {permissionStatus === 'denied' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-300 mb-3">
                        To enable camera access:
                        <br />• Click the camera icon in your browser's address bar
                        <br />• Or go to Settings → Privacy → Camera
                        <br />• Allow access for this site
                      </p>
                      <Button
                        onClick={startScanning}
                        className="bg-yah-gold text-yah-darker font-semibold text-sm"
                      >
                        <i className="fas fa-camera mr-2"></i>
                        Try Again
                      </Button>
                    </div>
                  )}
                  
                  {permissionStatus === 'prompt' && (
                    <Button
                      onClick={startScanning}
                      className="bg-yah-gold text-yah-darker font-semibold text-sm"
                    >
                      <i className="fas fa-camera mr-2"></i>
                      Allow Camera Access
                    </Button>
                  )}
                  
                  {!error.includes("permission") && (
                    <Button
                      onClick={startScanning}
                      className="bg-yah-gold text-yah-darker font-semibold text-sm"
                    >
                      <i className="fas fa-redo mr-2"></i>
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Development Mode Testing */}
          {isDevelopmentMode && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <i className="fas fa-code text-blue-400"></i>
                <h4 className="text-blue-400 font-semibold">Development Mode</h4>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                Test QR code booking without camera access
              </p>
              
              <div className="space-y-2">
                <Button
                  onClick={testWithMockData}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  <i className="fas fa-qrcode mr-2"></i>
                  Test with Mock Driver
                </Button>
                
                <div className="flex space-x-2">
                  <Button
                    onClick={() => testWithCustomDriverId("test-driver-1")}
                    variant="outline"
                    className="flex-1 border-blue-500/30 text-blue-400"
                  >
                    Driver 1
                  </Button>
                  <Button
                    onClick={() => testWithCustomDriverId("test-driver-2")}
                    variant="outline"
                    className="flex-1 border-blue-500/30 text-blue-400"
                  >
                    Driver 2
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Enter custom driver ID"
                    value={customDriverId}
                    onChange={(e) => setCustomDriverId(e.target.value)}
                    className="bg-gray-800 border-blue-500/30 text-white placeholder:text-gray-400"
                  />
                  <Button
                    onClick={() => testWithCustomDriverId(customDriverId || "custom-driver")}
                    disabled={!customDriverId.trim()}
                    variant="outline"
                    className="w-full border-blue-500/30 text-blue-400"
                  >
                    <i className="fas fa-play mr-2"></i>
                    Test Custom Driver ID
                  </Button>
                </div>
                
                <p className="text-xs text-gray-400 text-center">
                  Default Mock Driver ID: 9daf8924-e476-4707-8152-4c0e45680d7c
                </p>
              </div>
            </div>
          )}
          
          {/* Instructions */}
          <div className="text-center text-gray-400 text-sm">
            <p>Point your camera at the driver's QR code</p>
            <p className="text-xs mt-1">QR code should be from Yah Mobility LLC</p>
            {!window.isSecureContext && (
              <p className="text-xs mt-1 text-yellow-400">
                <i className="fas fa-exclamation-triangle mr-1"></i>
                Camera requires HTTPS connection
              </p>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex space-x-3">
            {!isDevelopmentMode && (
              <>
                {!isScanning ? (
                  <Button
                    onClick={startScanning}
                    className="flex-1 bg-gradient-gold text-yah-darker font-semibold"
                  >
                    <i className="fas fa-camera mr-2"></i>
                    Start Scanning
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanning}
                    variant="outline"
                    className="flex-1 border-yah-gold/30 text-yah-gold"
                  >
                    <i className="fas fa-stop mr-2"></i>
                    Stop Scanning
                  </Button>
                )}
              </>
            )}
            
            <Button
              onClick={handleClose}
              variant="outline"
              className={isDevelopmentMode ? "flex-1 border-gray-500 text-gray-400" : "border-gray-500 text-gray-400"}
            >
              {isDevelopmentMode ? "Close" : "Cancel"}
            </Button>
          </div>
          
          {/* Manual Entry Option */}
          <div className="text-center">
            <Button
              onClick={() => {
                handleClose();
                setLocation('/booking');
              }}
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              <i className="fas fa-keyboard mr-2"></i>
              Enter driver ID manually
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
