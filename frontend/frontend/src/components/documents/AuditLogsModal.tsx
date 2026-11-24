import React from 'react';
import { X, Shield, Clock, HardDrive, FileText } from 'lucide-react';
import { useDocuments } from '../../context/DocumentContext';
import { formatDateTime } from '../../utils/formatters';

export const AuditLogsModal: React.FC = () => {
  const { auditDoc, setAuditDoc, auditLogs } = useDocuments();

  if (!auditDoc) return null;

  const docLogs = auditLogs.filter((log) => log.documentId === auditDoc.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                Audit Trail & Access History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                {auditDoc.title}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAuditDoc(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Log Stream */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {docLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recorded audit events for this specific file yet.</p>
            </div>
          ) : (
            <div className="relative pl-6 border-l border-slate-200 dark:border-slate-800 space-y-6">
              {docLogs.map((log) => (
                <div key={log.id} className="relative group">
                  <div className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.action}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
                    <span>Actor: {log.actorName}</span>
                    <span>·</span>
                    <span>IP: {log.ipAddress}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-900/60">
          <span>Immutable HMAC log signature</span>
          <button
            onClick={() => setAuditDoc(null)}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg transition-colors text-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
