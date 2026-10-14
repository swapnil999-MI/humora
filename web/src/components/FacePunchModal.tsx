import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ScanFace, X } from 'lucide-react';
import { useHrmsStore } from '../store/hrmsStore';
import { useUiStore } from '../store/uiStore';

// Every web punch goes through this dialog: a live webcam selfie is checked against the
// employee's enrolled face on the server (POST /hrms/attendance/punch-with-face).

const PUNCH_LABELS: Record<string, string> = {
  in: 'Check-in',
  out: 'Check-out',
  break_start: 'Start break',
  break_end: 'End break',
};

function currentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
  });
}

function captureFrame(video: HTMLVideoElement): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, 800 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export const FacePunchModal: React.FC = () => {
  const request = useHrmsStore((s) => s.facePunchRequest);
  const finishFacePunch = useHrmsStore((s) => s.finishFacePunch);
  const punchWithFace = useHrmsStore((s) => s.punchWithFace);
  const addToast = useUiStore((s) => s.addToast);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!request) return;
    setError(null);
    setCameraError(null);
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot open the camera. Use a current browser over HTTPS, or punch from the Humora app.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setCameraError('Camera access was blocked. Allow the camera for this site to punch with your face.'));
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [request, stopCamera]);

  if (!request) return null;

  const label = PUNCH_LABELS[request.punchType] || 'Punch';

  const close = () => {
    if (busy) return;
    stopCamera();
    finishFacePunch({ ok: false });
  };

  const verifyAndPunch = async () => {
    const video = videoRef.current;
    const selfie = video ? captureFrame(video) : null;
    if (!selfie) {
      setError('The camera is not ready yet. Wait a moment and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const pos = await currentPosition();
      const res = await punchWithFace({
        punch_type: request.punchType,
        selfie_image: selfie,
        latitude: pos?.coords.latitude,
        longitude: pos?.coords.longitude,
        source: 'web',
      });
      addToast({ type: 'success', message: res?.message || `${label} recorded with face verification.` });
      stopCamera();
      finishFacePunch({ ok: true, value: res });
    } catch (err: any) {
      setError(err?.message || (typeof err === 'string' ? err : 'Face verification failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScanFace size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{label} with face</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={close} disabled={busy} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4 / 3',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#000',
            border: '1px solid var(--border-hairline)',
          }}
        >
          {cameraError ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '13px',
              }}
            >
              <Camera size={28} />
              {cameraError}
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          )}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '12px 0 0' }}>
          Look straight at the camera in good light. Your face is matched with the photo HR enrolled; location is
          checked against your office.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--accent-rose)',
              background: 'var(--surface-2)',
              border: '1px solid var(--accent-rose)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={verifyAndPunch} disabled={busy || !!cameraError}>
            {busy ? 'Verifying…' : `Verify face & ${label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacePunchModal;
