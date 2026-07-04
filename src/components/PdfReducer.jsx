import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { 
  UploadCloud, 
  Trash2, 
  Sparkles, 
  FileText,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PdfReducer() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedData, setCompressedData] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Format bytes helper
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
    
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile || droppedFile.type !== 'application/pdf') {
      toast({
        title: 'Invalid File',
        description: 'Please drop a single PDF file only.',
        variant: 'destructive'
      });
      return;
    }

    setFile(droppedFile);
    setCompressedData(null);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setCompressedData(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (compressedData?.downloadUrl) {
      window.URL.revokeObjectURL(compressedData.downloadUrl);
    }
    setCompressedData(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Call API to compress file
  const handleCompress = async () => {
    if (!file) return;

    setIsCompressing(true);
    toast({
      title: 'Optimizing PDF',
      description: 'Compressing document streams and stripping metadata...'
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('compressionLevel', 'medium'); // Default compression level

    try {
      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to compress document.');
      }

      // Read custom headers set by backend
      const originalSize = Number(response.headers.get('x-original-size')) || file.size;
      const compressedSize = Number(response.headers.get('x-compressed-size')) || file.size;
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const fileName = `optimized_${file.name}`;

      // Trigger automatic browser download DIRECTLY
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const ratio = ((1 - compressedSize / originalSize) * 100);

      toast({
        title: 'PDF Compressed',
        description: `Successfully reduced size by ${ratio.toFixed(0)}%! Download started automatically.`,
        variant: 'success'
      });

      // Save compression data in state so they can download it multiple times
      setCompressedData({
        downloadUrl,
        fileName,
        ratio: ratio.toFixed(0)
      });

      // Spark confetti
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.7 }
      });

    } catch (err) {
      console.error(err);
      toast({
        title: 'Compression Failed',
        description: err.message || 'An error occurred during compression.',
        variant: 'destructive'
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const triggerManualDownload = () => {
    if (!compressedData) return;
    const link = document.createElement('a');
    link.href = compressedData.downloadUrl;
    link.download = compressedData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      
      <Card className="glass-panel border border-slate-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            PDF Reducer Tool
          </CardTitle>
          <CardDescription>
            Optimize heavy PDF documents. Strips excess metadata and compresses document streams to make them lightweight for email attachments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Drag & Drop Upload Zone */}
          {!file && (
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
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl text-slate-400 mb-3 group-hover:scale-105 transition-all">
                <UploadCloud className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <h3 className="font-semibold text-slate-200 text-base">Drag & drop your PDF file here</h3>
              <p className="text-xs text-slate-500 mt-1.5">or click to browse from explorer</p>
              <p className="text-[10px] text-slate-600 mt-3 font-semibold uppercase tracking-wider">Supports up to 15MB file size</p>
            </div>
          )}

          {/* Selected File Details & Actions */}
          {file && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 shrink-0">
                    <FileText className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate pr-4">{file.name}</div>
                    <div className="text-xs text-slate-400 mt-1">Size: {formatBytes(file.size)}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    disabled={isCompressing}
                    className="h-9 w-9 text-slate-450 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {!compressedData && (
                    <Button
                      onClick={handleCompress}
                      isLoading={isCompressing}
                      className="h-10 px-4 font-semibold gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                      Compress
                    </Button>
                  )}
                </div>
              </div>

              {/* Redownload dashboard */}
              {compressedData && (
                <div className="p-4 bg-slate-950/35 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="text-xs text-slate-450 leading-relaxed text-center sm:text-left">
                    <span className="text-emerald-450 font-bold block mb-0.5">✓ Compression Complete</span>
                    Reduced file size by <span className="font-bold text-white">{compressedData.ratio}%</span>. Download started automatically.
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      onClick={removeFile}
                      className="text-xs h-9 px-3 flex-1 sm:flex-initial"
                    >
                      Compress Another
                    </Button>
                    <Button 
                      onClick={triggerManualDownload}
                      className="text-xs h-9 px-4 gap-1.5 flex-1 sm:flex-initial font-bold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Again
                    </Button>
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
