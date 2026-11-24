import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle, 
  X, 
  Sparkles,
  ArrowRight,
  Eye,
  Share2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes } from '../../utils/formatters';
import { DocumentCategory, SensitivityLevel, FileType, DocumentItem } from '../../types';

interface StagedFile {
  id: string;
  file: File;
  title: string;
  category: DocumentCategory | '';
  sensitivity: SensitivityLevel | '';
  tags: string[];
  description: string;
  progress: number;
  stage: 'idle' | 'checking' | 'uploading' | 'completed' | 'error';
  createdDoc?: DocumentItem;
}

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addDocument, setPreviewDoc, setShareDoc, addToast } = useDocuments();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Default form attributes for newly dropped files
  const [defaultCategory, setDefaultCategory] = useState<DocumentCategory | ''>('');
  const [defaultSensitivity, setDefaultSensitivity] = useState<SensitivityLevel | ''>('');
  const [tagInput, setTagInput] = useState('');

  if (!currentUser) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const supportedExtensions = new Set(['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'zip', 'txt']);
    const validFiles = Array.from(files).filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!supportedExtensions.has(extension)) {
        addToast('error', 'Unsupported file', `${file.name} is not a supported file type.`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        addToast('error', 'File too large', `${file.name} exceeds the 50 MB limit.`);
        return false;
      }
      return true;
    });

    const newStaged: StagedFile[] = validFiles.map((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || 'txt';
      const cleanTitle = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      return {
        id: `staged-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        file: f,
        title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
        category: defaultCategory,
        sensitivity: defaultSensitivity,
        tags: tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        description: `Uploaded file: ${f.name}`,
        progress: 0,
        stage: 'idle',
      };
    });

    setStagedFiles((prev) => [...newStaged, ...prev]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Let users select the same file again after removing it from the queue.
    e.target.value = '';
  };

  const removeStaged = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateStaged = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const startUploadPipeline = async () => {
    const pending = stagedFiles.filter((f) => f.stage === 'idle');
    if (pending.length === 0) return;
    const missingClassification = pending.filter(file => !file.category || !file.sensitivity);
    if (missingClassification.length > 0) {
      addToast('error', 'Classification required', 'Choose a category and sensitivity for each queued file before uploading.');
      return;
    }

    setIsProcessing(true);

    for (const staged of pending) {
      updateStaged(staged.id, { stage: 'checking', progress: 15 });
      const rawFile = new Uint8Array(await staged.file.arrayBuffer());
      let binaryFile = '';
      for (let offset = 0; offset < rawFile.length; offset += 0x8000) {
        binaryFile += String.fromCharCode(...rawFile.subarray(offset, offset + 0x8000));
      }
      const fileContentBase64 = btoa(binaryFile);

      // Step 4: Vaulted in state
      const ext = (staged.file.name.split('.').pop()?.toLowerCase() || 'txt') as FileType;
      const validFileType: FileType = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'zip', 'txt'].includes(ext)
        ? (ext as FileType)
        : 'txt';

      try {
      const created = await addDocument({
        title: staged.title,
        originalFileName: staged.file.name,
        fileType: validFileType,
        fileSizeBytes: staged.file.size,
        category: staged.category as DocumentCategory,
        tags: staged.tags,
        sensitivity: staged.sensitivity as SensitivityLevel,
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        ownerAvatar: currentUser.avatar,
        isStarred: false,
        isArchived: false,
        description: staged.description,
        textContentSample: staged.file.type === 'text/plain' ? (await staged.file.text()).slice(0, 10000) : '',
        fileContentBase64,
      });

      updateStaged(staged.id, { stage: 'completed', progress: 100, createdDoc: created });
      } catch {
        updateStaged(staged.id, { stage: 'error', progress: 0 });
      }
    }

    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Upload Documents
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload files to your workspace and choose their access classification.
        </p>
      </div>

      {/* Preset Classification Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Classification for queued and future files
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={defaultCategory}
              onChange={(e) => {
                const category = e.target.value as DocumentCategory | '';
                setDefaultCategory(category);
                setStagedFiles(files => files.map(file => file.stage === 'idle' ? { ...file, category } : file));
              }}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="">No default — choose per file</option>
              <option value="Legal & Contracts">Legal & Contracts</option>
              <option value="Financial & Tax">Financial & Tax</option>
              <option value="Security & Compliance">Security & Compliance</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Engineering & Tech">Engineering & Tech</option>
              <option value="Marketing & Sales">Marketing & Sales</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sensitivity Tier
            </label>
            <select
              value={defaultSensitivity}
              onChange={(e) => {
                const sensitivity = e.target.value as SensitivityLevel | '';
                setDefaultSensitivity(sensitivity);
                setStagedFiles(files => files.map(file => file.stage === 'idle' ? { ...file, sensitivity } : file));
              }}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="">No default — choose per file</option>
              <option value="Restricted">Restricted (Highest)</option>
              <option value="Confidential">Confidential (Default)</option>
              <option value="Internal">Internal Team Only</option>
              <option value="Public">Public Access</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => {
                const value = e.target.value;
                const tags = value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
                setTagInput(value);
                setStagedFiles(files => files.map(file => file.stage === 'idle' ? { ...file, tags } : file));
              }}
              placeholder="Optional, e.g. audit, q4, board"
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={handleFileSelect}
        />

        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Drop document files here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto">
          Supports PDF, DOCX, XLSX, PPTX, PNG, JPG, ZIP, and TXT files up to 50 MB.
        </p>

        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            Malware & Virus Scanned
          </span>
        </div>
      </div>

      {/* Staged Upload Queue */}
      {stagedFiles.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Upload Queue ({stagedFiles.length})
            </h2>

            {stagedFiles.some((f) => f.stage === 'idle') && (
              <button
                onClick={startUploadPipeline}
                disabled={isProcessing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Encrypting & Vaulting...' : 'Start Secure Upload'}
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stagedFiles.map((staged) => (
              <div key={staged.id} className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <input
                        type="text"
                        value={staged.title}
                        disabled={staged.stage !== 'idle'}
                        onChange={(e) => updateStaged(staged.id, { title: e.target.value })}
                        className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none w-full"
                      />
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{staged.file.name}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">{formatBytes(staged.file.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {staged.stage === 'completed' && staged.createdDoc ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewDoc(staged.createdDoc!)}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                        <button
                          onClick={() => setShareDoc(staged.createdDoc!)}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => removeStaged(staged.id)}
                        disabled={isProcessing}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {staged.stage === 'idle' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Category
                    <select value={staged.category} onChange={event => updateStaged(staged.id, { category: event.target.value as DocumentCategory | '' })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="">Choose a category</option>
                      <option value="Legal & Contracts">Legal & Contracts</option>
                      <option value="Financial & Tax">Financial & Tax</option>
                      <option value="Security & Compliance">Security & Compliance</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Engineering & Tech">Engineering & Tech</option>
                      <option value="Marketing & Sales">Marketing & Sales</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </label>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Sensitivity
                    <select value={staged.sensitivity} onChange={event => updateStaged(staged.id, { sensitivity: event.target.value as SensitivityLevel | '' })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="">Choose sensitivity</option>
                      <option value="Restricted">Restricted</option>
                      <option value="Confidential">Confidential</option>
                      <option value="Internal">Internal</option>
                      <option value="Public">Public</option>
                    </select>
                  </label>
                </div>}

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-medium capitalize text-slate-600 dark:text-slate-300">
                      {staged.stage === 'idle' && 'Waiting for confirmation'}
                      {staged.stage === 'checking' && 'Checking file...'}
                      {staged.stage === 'uploading' && 'Uploading file to workspace...'}
                      {staged.stage === 'completed' && 'Upload complete'}
                      {staged.stage === 'error' && 'Upload failed. Remove the file and try again.'}
                    </span>
                    <span className="font-mono text-slate-500">{staged.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        staged.stage === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${staged.progress}%` }}
                    />
                  </div>
                </div>

              </div>
            ))}
          </div>

          {stagedFiles.every((f) => f.stage === 'completed') && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => navigate('/documents')}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                <span>Go to Repository</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
