import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { 
  UploadCloud, 
  File, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Combine, 
  X,
  FileCheck2,
  Sparkles,
  Download,
  RefreshCw,
  Percent,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PdfMerger() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedResult, setMergedResult] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Drag and drop events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );

    if (droppedFiles.length === 0) {
      toast({
        title: 'Invalid Files',
        description: 'Please drop PDF files only.',
        variant: 'destructive'
      });
      return;
    }

    addFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files).filter(
      file => file.type === 'application/pdf'
    );
    addFiles(selected);
  };

  const addFiles = (newFiles) => {
    // Check duplicate files
    const filtered = newFiles.filter(
      newFile => !files.some(f => f.name === newFile.name && f.size === newFile.size)
    );

    if (filtered.length < newFiles.length) {
      toast({
        title: 'Duplicates Skipped',
        description: 'Some files were already in the merge queue.'
      });
    }

    if (files.length + filtered.length > 10) {
      toast({
        title: 'Queue Limit',
        description: 'You can merge a maximum of 10 PDFs at a time.',
        variant: 'destructive'
      });
      // slice up to 10
      setFiles(prev => [...prev, ...filtered].slice(0, 10));
    } else {
      setFiles(prev => [...prev, ...filtered]);
    }
  };

  // Remove file from queue
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Move file up in order
  const moveUp = (index) => {
    if (index === 0) return;
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index - 1];
    newFiles[index - 1] = temp;
    setFiles(newFiles);
  };

  // Move file down in order
  const moveDown = (index) => {
    if (index === files.length - 1) return;
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index + 1];
    newFiles[index + 1] = temp;
    setFiles(newFiles);
  };

  // Trigger file dialog
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Clear queue
  const clearQueue = () => {
    setFiles([]);
    toast({
      title: 'Queue Cleared',
      description: 'The PDF merge queue has been emptied.'
    });
  };

  // Call API to merge files
  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: 'Merge Requirement',
        description: 'Please upload at least 2 PDF files to combine.',
        variant: 'destructive'
      });
      return;
    }

    setIsMerging(true);
    setMergedResult(null); // Reset past results
    toast({
      title: 'Merging PDFs',
      description: 'Sending files to server for compilation...'
    });

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/merge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to merge documents.');
      }

      // Convert response to Blob
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      setMergedResult({
        blob,
        downloadUrl,
        size: blob.size,
        fileName: `merged_${Date.now()}.pdf`,
        originalFileName: `merged_${Date.now()}.pdf`,
        isCompressed: false,
      });

      // Trigger Confetti
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.8 }
      });

      toast({
        title: 'Merge Successful!',
        description: 'Your combined PDF is ready. Download or compress it below.',
        variant: 'success'
      });

      // Clear merge queue
      setFiles([]);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Merge Failed',
        description: err.message || 'An error occurred during merging.',
        variant: 'destructive'
      });
    } finally {
      setIsMerging(false);
    }
  };

  // Compress Merged PDF Blob
  const handleCompressMerged = async () => {
    if (!mergedResult) return;

    setIsCompressing(true);
    toast({
      title: 'Optimizing Merged File',
      description: 'Compressing objects and page streams...'
    });

    const formData = new FormData();
    const file = new window.File([mergedResult.blob], mergedResult.fileName, { type: 'application/pdf' });
    formData.append('file', file);

    try {
      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to compress merged document.');
      }

      const originalSize = Number(response.headers.get('x-original-size')) || mergedResult.size;
      const compressedSize = Number(response.headers.get('x-compressed-size')) || mergedResult.size;

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      setMergedResult(prev => ({
        ...prev,
        blob,
        downloadUrl,
        size: compressedSize,
        originalSize,
        compressedSize,
        savedPercent: Math.max(0, parseFloat(((1 - compressedSize / originalSize) * 100).toFixed(1))),
        fileName: `compressed_${prev.fileName}`,
        isCompressed: true,
      }));

      // Trigger Confetti
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.8 }
      });

      toast({
        title: 'Compression Complete!',
        description: 'Your merged PDF size has been optimized.',
        variant: 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Compression Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsCompressing(false);
    }
  };

  // Reset Results
  const handleResetMergeResult = () => {
    if (mergedResult?.downloadUrl) {
      window.URL.revokeObjectURL(mergedResult.downloadUrl);
    }
    setMergedResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Combine className="w-5 h-5 text-violet-500" />
            PDF Merger Tool
          </CardTitle>
          <CardDescription>
            Combine multiple PDF files into a single, cohesive document. Drag-and-drop to upload and re-order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 select-none flex flex-col items-center justify-center min-h-[220px] ${
              isDragging 
                ? 'border-violet-500 bg-violet-950/20 shadow-lg shadow-violet-950/20' 
                : 'border-slate-800 bg-slate-900/25 hover:border-slate-700 hover:bg-slate-900/40'
            }`}
          >
            <input 
              type="file" 
              multiple 
              accept="application/pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl text-slate-400 mb-3 group-hover:scale-105 transition-all">
              <UploadCloud className="w-8 h-8 text-violet-400 animate-pulse" />
            </div>
            <h3 className="font-semibold text-slate-200 text-base">Drag & drop your PDFs here</h3>
            <p className="text-xs text-slate-500 mt-1.5">or click to browse from explorer</p>
            <p className="text-[10px] text-slate-600 mt-3 font-semibold uppercase tracking-wider">Supports up to 10 files (max 15MB each)</p>
          </div>

          {/* Merge Queue List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                <span>Merge Queue ({files.length} files)</span>
                <button 
                  onClick={clearQueue}
                  className="text-rose-500 hover:text-rose-400 lowercase first-letter:uppercase transition-colors"
                >
                  Clear Queue
                </button>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {files.map((file, index) => (
                  <div 
                    key={`${file.name}_${file.size}_${index}`}
                    className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-850 hover:border-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 shrink-0">
                        <File className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate pr-4">{file.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{formatBytes(file.size)}</div>
                      </div>
                    </div>

                    {/* Order adjustments & delete actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="h-8 w-8 text-slate-400 hover:text-white"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveDown(index)}
                        disabled={index === files.length - 1}
                        className="h-8 w-8 text-slate-400 hover:text-white"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-500"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Merge button */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  PDFs will be combined in the order displayed above.
                </div>
                <Button
                  onClick={handleMerge}
                  isLoading={isMerging}
                  className="px-6 h-11 gap-2 shrink-0 font-semibold"
                >
                  <Combine className="w-4 h-4" />
                  Merge files ({files.length})
                </Button>
              </div>
            </div>
          )}

          {/* Merge Success Card */}
          {mergedResult && (
            <div className="p-5 bg-slate-950/60 border border-slate-850 rounded-xl space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-slate-200">Merged PDF is ready!</span>
                </div>
                <button
                  onClick={handleResetMergeResult}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded"
                >
                  <RefreshCw className="w-3 h-3" />
                  Start Over
                </button>
              </div>

              {/* PDF Details */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-900/40 border border-slate-850 rounded-lg gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 shrink-0">
                    <File className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate pr-4">{mergedResult.fileName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Final Size: {formatBytes(mergedResult.size)}</div>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <a
                    href={mergedResult.downloadUrl}
                    download={mergedResult.fileName}
                    className="flex-1 sm:flex-initial"
                  >
                    <Button className="w-full h-10 gap-1.5 font-semibold text-xs">
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </Button>
                  </a>

                  {!mergedResult.isCompressed && (
                    <Button
                      variant="outline"
                      onClick={handleCompressMerged}
                      isLoading={isCompressing}
                      className="flex-1 sm:flex-initial h-10 text-xs border-violet-850 hover:bg-violet-600 hover:text-white gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Compress PDF
                    </Button>
                  )}
                </div>
              </div>

              {/* Compression metrics if performed */}
              {mergedResult.isCompressed && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-violet-950/20 border border-violet-900/40 rounded-xl relative overflow-hidden">
                  <Percent className="absolute right-2 bottom-2 w-12 h-12 text-violet-500/10 pointer-events-none" />
                  <div>
                    <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Original Merged</span>
                    <div className="text-sm font-bold text-slate-300 mt-0.5">{formatBytes(mergedResult.originalSize)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Optimized Size</span>
                    <div className="text-sm font-bold text-violet-450 mt-0.5">{formatBytes(mergedResult.compressedSize)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-violet-400 uppercase font-bold tracking-wider">Disk Saved</span>
                    <div className="text-sm font-extrabold text-emerald-450 mt-0.5">{mergedResult.savedPercent}% smaller</div>
                  </div>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>

    </div>
  );
}
