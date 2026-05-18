import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Pen, Trash2, Check, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';

interface SignaturePadProps {
  isOpen: boolean;
  onClose: () => void;
  onSigned: (signatureId: string, signatureDataUrl: string) => void;
  contextType:
    | 'shift_handover'
    | 'incident_acknowledgment'
    | 'visitor_signoff'
    | 'logbook_entry'
    | 'custom';
  contextId?: string;
  contextDescription?: string;
}

interface SignatureDisplayProps {
  signatureDataUrl: string;
  signerName: string;
  signedAt: string;
  compact?: boolean;
}

const CONTEXT_LABELS: Record<SignaturePadProps['contextType'], string> = {
  shift_handover: 'Shift Handover Acknowledgment',
  incident_acknowledgment: 'Incident Acknowledgment',
  visitor_signoff: 'Visitor Sign-Off',
  logbook_entry: 'Logbook Entry Confirmation',
  custom: 'Signature Required',
};

export function SignaturePad({
  isOpen,
  onClose,
  onSigned,
  contextType,
  contextId,
  contextDescription,
}: SignaturePadProps) {
  const { user, profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [isEmpty, setIsEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const getCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx };
  }, []);

  const resizeCanvas = useCallback(() => {
    const result = getCanvasContext();
    if (!result) return;
    const { canvas, ctx } = result;
    const container = containerRef.current;
    if (!container) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.scale(dpr, dpr);
    ctx.putImageData(imageData, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1a2e';
  }, [getCanvasContext]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      resizeCanvas();
    }, 50);

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, resizeCanvas]);

  const getCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();

      if ('touches' in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        if (!touch) return null;
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      }

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const point = getCoordinates(e);
      if (!point) return;

      isDrawingRef.current = true;
      lastPointRef.current = point;
      setIsEmpty(false);

      const result = getCanvasContext();
      if (!result) return;
      const { ctx } = result;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    },
    [getCoordinates, getCanvasContext]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;

      const point = getCoordinates(e);
      if (!point) return;

      const result = getCanvasContext();
      if (!result) return;
      const { ctx } = result;

      if (lastPointRef.current) {
        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }

      lastPointRef.current = point;
    },
    [getCoordinates, getCanvasContext]
  );

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const result = getCanvasContext();
    if (!result) return;
    const { canvas, ctx } = result;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }, [getCanvasContext]);

  const handleConfirm = useCallback(async () => {
    if (isEmpty) {
      showToast('error', 'Please provide your signature before confirming.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !user) return;

    setIsSaving(true);

    try {
      const signatureDataUrl = canvas.toDataURL('image/png');

      const { data, error } = await supabase
        .from('digital_signatures')
        .insert({
          company_id: profile?.company_id,
          signer_id: user.id,
          signature_data: signatureDataUrl,
          context_type: contextType,
          context_id: contextId || null,
          context_description: contextDescription || null,
          signed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      showToast('success', 'Signature captured successfully.');
      onSigned(data.id, signatureDataUrl);
      onClose();
    } catch (err) {
      console.error('Failed to save signature:', err);
      showToast('error', 'Failed to save signature. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    isEmpty,
    user,
    profile,
    contextType,
    contextId,
    contextDescription,
    onSigned,
    onClose,
  ]);

  useEffect(() => {
    if (!isOpen) {
      clearCanvas();
      setIsSaving(false);
    }
  }, [isOpen, clearCanvas]);

  if (!isOpen) return null;

  const signerName = profile?.full_name || user?.email || 'Unknown';

  const currentTimestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Pen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {CONTEXT_LABELS[contextType]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {contextDescription && (
            <p className="text-sm text-gray-600 leading-relaxed">
              {contextDescription}
            </p>
          )}

          {/* Signature Canvas */}
          <div>
            <div
              ref={containerRef}
              className={`relative w-full rounded-xl bg-white overflow-hidden ${
                isEmpty
                  ? 'border-2 border-dashed border-gray-300'
                  : 'border-2 border-solid border-blue-400'
              }`}
              style={{ aspectRatio: '2.5 / 1' }}
            >
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {isEmpty && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-gray-300 text-sm select-none">
                    Draw your signature here
                  </span>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-400 text-center tracking-wide uppercase">
              Sign above
            </p>
          </div>

          {/* Signer Info */}
          <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
            <span className="font-medium text-gray-700">{signerName}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {currentTimestamp}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={clearCanvas}
            disabled={isEmpty || isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isEmpty || isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Confirm & Sign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignatureDisplay({
  signatureDataUrl,
  signerName,
  signedAt,
  compact = false,
}: SignatureDisplayProps) {
  const formattedDate = new Date(signedAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
        <img
          src={signatureDataUrl}
          alt={`Signature of ${signerName}`}
          className="h-6 w-auto object-contain"
        />
        <div className="text-xs text-gray-500 leading-none">
          <span className="font-medium text-gray-700">{signerName}</span>
          <span className="mx-1">--</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-3">
      <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center border border-gray-100">
        <img
          src={signatureDataUrl}
          alt={`Signature of ${signerName}`}
          className="max-h-20 w-auto object-contain"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-800">{signerName}</span>
        <span className="flex items-center gap-1 text-gray-500 text-xs">
          <Clock className="w-3 h-3" />
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
