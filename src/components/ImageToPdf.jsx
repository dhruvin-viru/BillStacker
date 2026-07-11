import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import AdBanner from './AdBanner';
import NativeAdBanner from './NativeAdBanner';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Download, 
  FileText, 
  ArrowLeftRight,
  Settings
} from 'lucide-react';

export default function ImageToPdf({ currentUser }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  const [margin, setMargin] = useState('none'); // 'none' | 'small' | 'large'
  const [pdfResult, setPdfResult] = useState(null); // { blobUrl, size }
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    addImages(files);
  };

  const addImages = (files) => {
    const validImages = files.filter(file => file.type.startsWith('image/'));
    
    if (validImages.length === 0) {
      toast({
        title: 'Invalid Files',
        description: 'Please select valid JPG, PNG, or WebP image files.',
        variant: 'destructive'
      });
      return;
    }

    const newItems = validImages.map(file => ({
      id: 'img_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
      file: file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      url: URL.createObjectURL(file)
    }));

    setImages(prev => [...prev, ...newItems]);
    toast({
      title: 'Images Added',
      description: `Added ${validImages.length} image(s) to the compile queue.`
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    addImages(files);
  };

  const moveItem = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === images.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...images];
    
    // Swap items
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    setImages(updated);
  };

  const removeItem = (id, index) => {
    const updated = [...images];
    // Revoke the blob URL to free memory
    URL.revokeObjectURL(updated[index].url);
    updated.splice(index, 1);
    setImages(updated);
  };

  const handleCompile = async () => {
    if (images.length === 0) {
      toast({
        title: 'Queue Empty',
        description: 'Please add at least one image to compile.',
        variant: 'destructive'
      });
      return;
    }

    // Helper to compile/convert any image to standard JPEG on the client
    const convertToJpeg = (item) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = item.url;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const cleanedFile = new File([blob], item.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });
              resolve(cleanedFile);
            } else {
              resolve(item.file);
            }
          }, 'image/jpeg', 0.9);
        };
        img.onerror = () => resolve(item.file);
      });
    };

    try {
      setLoading(true);
      const formData = new FormData();
      
      const processedFiles = await Promise.all(images.map(item => convertToJpeg(item)));
      processedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('orientation', orientation);
      formData.append('margin', margin);
      formData.append('isPremium', currentUser?.isPremium ? 'true' : 'false');

      const response = await fetch('/api/image-to-pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server returned an error compiling PDF.');
      }

      const pdfBlob = await response.blob();
      const blobUrl = URL.createObjectURL(pdfBlob);
      const sizeStr = (pdfBlob.size / (1024 * 1024)).toFixed(2) + ' MB';

      setPdfResult({
        blobUrl,
        size: sizeStr
      });

      toast({
        title: 'Compilation Success!',
        description: 'Your images have been compiled into a premium PDF.',
        variant: 'success'
      });

      // Auto trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'compiled_images.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      toast({
        title: 'Compilation Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetTool = () => {
    images.forEach(item => URL.revokeObjectURL(item.url));
    setImages([]);
    if (pdfResult) {
      URL.revokeObjectURL(pdfResult.blobUrl);
    }
    setPdfResult(null);
  };

  const triggerDownloadAgain = () => {
    if (!pdfResult) return;
    const link = document.createElement('a');
    link.href = pdfResult.blobUrl;
    link.download = 'compiled_images.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 bg-slate-900/30 border border-slate-900 rounded-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-violet-400" />
            Image to PDF Converter
          </h2>
          <p className="text-xs text-slate-400 mt-1">Compile multiple PNG, JPG, or WebP images into a single formatted PDF</p>
        </div>
        {!currentUser?.isPremium && (
          <div className="text-[10px] text-slate-500 bg-slate-950/40 border border-slate-850 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start sm:self-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>Watermarks will be applied in Free mode</span>
          </div>
        )}
      </div>

      {pdfResult ? (
        /* Results View */
        <Card className="glass-panel border-emerald-500/10 shadow-lg shadow-emerald-950/5">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-emerald-600/10 text-emerald-400 flex items-center justify-center mx-auto mb-2.5">
              <FileText className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-bold text-white">Compilation Complete</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Your images have been compiled into a single PDF document.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center bg-slate-955 p-3 rounded-lg border border-slate-900 text-xs">
              <span className="text-slate-400">PDF File Size:</span>
              <span className="text-white font-bold">{pdfResult.size}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={triggerDownloadAgain}
                className="h-10.5 border-slate-800 text-slate-300 font-semibold text-xs"
              >
                <Download className="w-4 h-4 mr-1.5" /> Download Again
              </Button>
              <Button
                onClick={resetTool}
                className="h-10.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs border-0"
              >
                Convert Another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Creator Workspace */
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
          {/* Uploader & List pane */}
          <div className="md:col-span-2 space-y-4">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-850 hover:border-violet-500/40 bg-slate-950/30 hover:bg-slate-950/60 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-9 h-9 text-slate-500 group-hover:text-violet-400 group-hover:scale-105 transition-all mb-3" />
              <div className="text-sm font-semibold text-slate-200">Drag & Drop Images here</div>
              <div className="text-[11px] text-slate-500 mt-1">Supports PNG, JPG, or WebP (max 10MB per file)</div>
            </div>

            {images.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Image Queue ({images.length})</span>
                  <button onClick={resetTool} className="text-rose-400 hover:text-rose-300 font-medium">Clear All</button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {images.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 text-xs"
                    >
                      <div className="flex items-center gap-3 truncate pr-4">
                        <img 
                          src={item.url} 
                          alt="preview" 
                          className="w-10 h-10 object-cover rounded border border-slate-800 shrink-0" 
                        />
                        <div className="truncate">
                          <div className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-[320px]">{item.name}</div>
                          <div className="text-[10px] text-slate-550 mt-0.5">{item.size}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveItem(index, 'up')}
                          disabled={index === 0}
                          className="h-7 w-7 text-slate-400 hover:text-white"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveItem(index, 'down')}
                          disabled={index === images.length - 1}
                          className="h-7 w-7 text-slate-400 hover:text-white"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id, index)}
                          className="h-7 w-7 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Config Sidebar */}
          <div className="space-y-4">
            <Card className="glass-card border border-slate-900">
              <CardHeader className="pb-3 border-b border-slate-900/60 flex flex-row items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-violet-400" />
                <CardTitle className="text-sm font-bold text-white">Page Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Orientation Selector */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Page Orientation</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOrientation('portrait')}
                      className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                        orientation === 'portrait'
                          ? 'bg-violet-600/10 border-violet-500 text-violet-400'
                          : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      onClick={() => setOrientation('landscape')}
                      className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                        orientation === 'landscape'
                          ? 'bg-violet-600/10 border-violet-500 text-violet-400'
                          : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>

                {/* Margins Selector */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Page Margins</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['none', 'small', 'large'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setMargin(opt)}
                        className={`py-2 rounded-lg border text-[10px] font-bold capitalize transition-all ${
                          margin === opt
                            ? 'bg-violet-600/10 border-violet-500 text-violet-400'
                            : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Compilation */}
                <Button
                  onClick={handleCompile}
                  disabled={loading || images.length === 0}
                  className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs border-0 shadow-lg shadow-violet-900/35"
                >
                  {loading ? 'Compiling PDF...' : `Compile ${images.length} Image(s) to PDF`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Native Ad Banner and Divider */}
      {!currentUser?.isPremium && (
        <div className="py-4 border-t border-b border-slate-850/80 my-4 w-full">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-2">Sponsor Feedback & Offers</div>
          <NativeAdBanner isPremium={currentUser?.isPremium} />
        </div>
      )}

      {/* Footer Banner Ad */}
      <div className="pt-6 border-t border-slate-850/60 mt-8 w-full">
        <AdBanner 
          adKey="fc0ded85e24429b5a4db05e69a625aee" 
          format="iframe" 
          width={728} 
          height={90} 
          className="hidden md:flex mx-auto" 
          isPremium={currentUser?.isPremium}
        />
        
        <AdBanner 
          adKey="8933000d942a27ecc84dd3451f31535c" 
          format="iframe" 
          width={320} 
          height={50} 
          className="flex md:hidden mx-auto" 
          isPremium={currentUser?.isPremium}
        />
        
      </div>
    </div>
  );
}
