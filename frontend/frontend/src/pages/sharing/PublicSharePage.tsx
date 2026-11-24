import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText, Lock, ShieldCheck } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';

interface SharedFile {
  id: string; title: string; fileName: string; fileType: string; fileSizeBytes: number;
  description?: string; allowDownload: boolean; watermark: boolean; ownerName: string;
}

export const PublicSharePage: React.FC = () => {
  const { linkId = '' } = useParams();
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<SharedFile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (secret = '') => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/v1/documents/public/${encodeURIComponent(linkId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: secret }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to open this share link.');
      setFile(data);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to open this share link.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [linkId]);

  const download = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/v1/documents/public/${encodeURIComponent(linkId)}/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Download failed.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = file?.fileName || 'document'; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Download failed.'); }
    finally { setLoading(false); }
  };

  return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
    <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
      <div className="mb-8 flex items-center gap-3"><div className="rounded-xl bg-indigo-600 p-2"><ShieldCheck /></div><div><h1 className="text-xl font-bold">DocVault</h1><p className="text-xs text-slate-400">Secure document share</p></div></div>
      {file ? <><div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-950 p-4"><FileText className="text-indigo-400"/><div className="min-w-0"><h2 className="truncate font-semibold">{file.title}</h2><p className="text-xs text-slate-400">{file.fileName} · {formatBytes(file.fileSizeBytes)}</p></div></div>
        {file.description && <p className="mb-5 text-sm text-slate-300">{file.description}</p>}
        <p className="mb-5 text-xs text-slate-400">Shared by {file.ownerName}{file.watermark ? ' · Watermark enabled' : ''}</p>
        {file.allowDownload ? <button disabled={loading} onClick={download} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500 disabled:opacity-50"><Download size={17}/>Download file</button> : <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">The owner has disabled downloads for this link.</p>}
      </> : <form onSubmit={e => { e.preventDefault(); void load(password); }} className="space-y-4"><div className="flex items-center gap-2"><Lock className="text-indigo-400"/><h2 className="font-semibold">Passphrase required</h2></div><p className="text-sm text-slate-400">Enter the passphrase provided by the document owner.</p><input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5" placeholder="Passphrase"/><button disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Checking…' : 'Open shared document'}</button></form>}
      {error && <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p>}
    </section>
  </main>;
};
