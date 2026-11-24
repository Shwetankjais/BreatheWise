import React from 'react';
import { NotificationView } from '../../lib/api/types';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { formatToIST } from '../../lib/aqi';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationView[];
  onMarkRead: (id: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Air Quality Notification Center"
      description="Persistent rule-triggered threshold events and severe inversion alerts"
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            No active notification alerts.
          </div>
        ) : (
          notifications.map(note => {
            const isRead = Boolean(note.read_at || note.status === 'read');
            const isSevere = note.value >= 250;
            const isHigh = note.value >= note.threshold;

            return (
              <div
                key={note.id}
                className={`p-4 rounded-xl border transition-all ${
                  isRead
                    ? 'bg-slate-50 border-slate-200 text-slate-600'
                    : 'bg-white border-amber-300 shadow-sm ring-1 ring-amber-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isSevere
                          ? 'bg-red-100 text-red-900 border border-red-200'
                          : isHigh
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isSevere ? 'Severe Spike' : isHigh ? 'Threshold Exceeded' : 'Advisory'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {formatToIST(note.created_at)}
                    </span>
                  </div>
                  {!isRead && (
                    <button
                      onClick={() => onMarkRead(note.id)}
                      className="text-xs text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                    >
                      Mark as read
                    </button>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-900 mt-2">
                  Observed {note.value.toFixed(1)} {note.unit || 'µg/m³'} (Threshold: {note.threshold} {note.unit || 'µg/m³'})
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Triggered by persistent rule ID <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">{note.rule_id}</code>.
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Status: {isRead ? 'Read' : 'Unread'}</span>
                  <span>Idempotent alert delivery</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Dialog>
  );
};
