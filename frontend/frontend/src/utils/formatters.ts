import { FileType, SensitivityLevel } from '../types';

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function getSensitivityColor(level: SensitivityLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case 'Restricted':
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800/60',
      };
    case 'Confidential':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/60',
      };
    case 'Internal':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800/60',
      };
    case 'Public':
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700',
      };
  }
}

export function getFileTypeBadge(fileType: FileType): {
  label: string;
  color: string;
} {
  switch (fileType) {
    case 'pdf':
      return { label: 'PDF', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300' };
    case 'docx':
      return { label: 'DOCX', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300' };
    case 'xlsx':
      return { label: 'XLSX', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' };
    case 'pptx':
      return { label: 'PPTX', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300' };
    case 'png':
    case 'jpg':
      return { label: 'IMG', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300' };
    case 'zip':
      return { label: 'ZIP', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300' };
    case 'txt':
    default:
      return { label: 'TXT', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
  }
}
