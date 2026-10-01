import React, { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function QrCodeModal({ event, onClose }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  if (!event) return null;

  const eventId = event.eventId || event._id;
  const guestUrl = `${window.location.origin}/guest/${eventId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `SeatHub-${eventId}-QRCode.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                {eventId}
              </span>
              <span className="text-xs text-gray-500 font-medium">Guest Access</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-1">
              {event.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1.5 rounded-xl hover:bg-gray-100 transition"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-5">
          {/* QR Code Canvas Box */}
          <div
            ref={qrRef}
            className="p-5 bg-white rounded-2xl shadow-inner border border-gray-200 inline-flex flex-col items-center"
          >
            <QRCodeCanvas
              value={guestUrl}
              size={220}
              level="H"
              includeMargin={true}
            />
            <p className="text-[11px] font-medium text-gray-400 mt-2">
              Scan with smartphone camera to open
            </p>
          </div>

          {/* Guest Link URL Card */}
          <div className="w-full text-left space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Guest Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={guestUrl}
                className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 select-all"
              />
              <button
                onClick={handleCopy}
                className={
                  'px-3.5 py-2.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1 ' +
                  (copied
                    ? 'bg-green-600 text-white shadow-xs'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs')
                }
              >
                {copied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="w-full flex items-center justify-between gap-3 pt-2">
            <button
              onClick={handleDownload}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              📥 Download QR
            </button>
            <a
              href={guestUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 border border-indigo-200 text-center"
            >
              ↗ Open Guest Page
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
