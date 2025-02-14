'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from './ui/Slider';
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Image as ImageIcon,
  Wand2,
  Undo2,
  Redo2,
  SunMedium,
  Contrast,
  Move,
  RotateCcw,
  Copy,
  Download,
  Sparkles,
  Loader2,
  Search,
  Youtube,
  Edit
} from 'lucide-react';

interface YouTubeVideo {
  title: string;
  link: string;
  thumbnail: string;
  views?: string;
  likes?: string;
}

interface ImageVersion {
  id: string;
  imageUrl: string;
  prompt?: string;
  timestamp: number;
  adjustments?: ImageAdjustments;
}

interface ImageAdjustments {
  brightness: number;
  contrast: number;
  position?: {
    x: number;
    y: number;
  };
}

interface EnhancedPrompt {
  title: string;
  prompt: string;
}

type Tool = 'select' | 'move' | 'magicWand';

const YOUTUBE_ASPECT_RATIO = 16 / 9;
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

export default function ImageEditor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [versions, setVersions] = useState<ImageVersion[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selection, setSelection] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    brightness: 100,
    contrast: 100
  });
  const [history, setHistory] = useState<ImageVersion[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [magicWandThreshold, setMagicWandThreshold] = useState(30);
  const [selectedPixels, setSelectedPixels] = useState<boolean[][]>([]);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [enhancedPrompts, setEnhancedPrompts] = useState<EnhancedPrompt[]>([]);
  const [showEnhancedPrompts, setShowEnhancedPrompts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      
      // Load image and resize to YouTube thumbnail dimensions
      const img = new Image();
      img.src = url;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = THUMBNAIL_WIDTH;
      canvas.height = THUMBNAIL_HEIGHT;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Calculate dimensions to maintain aspect ratio
        let drawWidth = THUMBNAIL_WIDTH;
        let drawHeight = THUMBNAIL_HEIGHT;
        let offsetX = 0;
        let offsetY = 0;

        const imgAspectRatio = img.width / img.height;
        if (imgAspectRatio > YOUTUBE_ASPECT_RATIO) {
          drawWidth = drawHeight * imgAspectRatio;
          offsetX = -(drawWidth - THUMBNAIL_WIDTH) / 2;
        } else {
          drawHeight = drawWidth / imgAspectRatio;
          offsetY = -(drawHeight - THUMBNAIL_HEIGHT) / 2;
        }

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        const resizedUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImageUrl(resizedUrl);
        setVersions([{
          id: '0',
          imageUrl: resizedUrl,
          timestamp: Date.now()
        }]);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'move') {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    } else if (currentTool === 'magicWand') {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get the clicked pixel color
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
      const clickedColor = {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2]
      };

      // Create selection matrix
      const selection = Array(canvas.height).fill(0).map(() => Array(canvas.width).fill(false));
      
      // Flood fill similar colors
      for (let py = 0; py < canvas.height; py++) {
        for (let px = 0; px < canvas.width; px++) {
          const i = (py * canvas.width + px) * 4;
          const currentColor = {
            r: imageData.data[i],
            g: imageData.data[i + 1],
            b: imageData.data[i + 2]
          };
          
          // Calculate color difference
          const colorDiff = Math.sqrt(
            Math.pow(clickedColor.r - currentColor.r, 2) +
            Math.pow(clickedColor.g - currentColor.g, 2) +
            Math.pow(clickedColor.b - currentColor.b, 2)
          );
          
          if (colorDiff <= magicWandThreshold) {
            selection[py][px] = true;
          }
        }
      }
      
      setSelectedPixels(selection);
      setIsSelecting(true);
    } else {
      // Default select tool behavior
      setIsSelecting(true);
      setStartPos({ x, y });
      setSelection({ x, y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    if (currentTool === 'move' && isDragging) {
      const newX = e.clientX - startPos.x;
      const newY = e.clientY - startPos.y;
      setPosition({ x: newX, y: newY });
    } else if (isSelecting && currentTool === 'select') {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const currentX = (e.clientX - rect.left) * scaleX;
      const currentY = (e.clientY - rect.top) * scaleY;
      
      setSelection({
        x: startPos.x,
        y: startPos.y,
        width: currentX - startPos.x,
        height: currentY - startPos.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (currentTool !== 'move') {
      setIsSelecting(false);
      setIsEditing(true);
    }
  };

  const generateMask = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !canvasRef.current) return null;

    // Set mask canvas to same dimensions as the image
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = THUMBNAIL_HEIGHT;

    // Create black background (unmasked area)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Create white mask (area to edit)
    ctx.fillStyle = 'white';
    
    // Ensure selection coordinates are positive
    const x = Math.min(selection.x, selection.x + selection.width);
    const y = Math.min(selection.y, selection.y + selection.height);
    const width = Math.abs(selection.width);
    const height = Math.abs(selection.height);
    
    ctx.fillRect(x, y, width, height);
    
    return canvas.toDataURL('image/png');
  };

  const handleEdit = async () => {
    if (!imageUrl || !prompt) return;
    
    setIsLoading(true);
    try {
      const mask = generateMask();
      if (!mask) {
        throw new Error('Failed to generate mask');
      }

      const response = await fetch('/api/replicate/edit-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          prompt,
          mask,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit image');
      }

      if (data.success && data.output) {
        const newVersion: ImageVersion = {
          id: String(versions.length),
          imageUrl: data.output,
          prompt,
          timestamp: Date.now()
        };
        setVersions([...versions, newVersion]);
        setImageUrl(data.output);
      } else {
        throw new Error('No output received from the API');
      }
    } catch (error) {
      console.error('Error editing image:', error);
      alert(error instanceof Error ? error.message : 'Failed to edit image');
    } finally {
      setIsLoading(false);
      setIsEditing(false);
      setPrompt('');
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    
    setIsLoading(true);
    try {
      console.log('Starting image generation with prompt:', prompt);
      const response = await fetch('/api/replicate/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok) {
        console.error('API error:', data);
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success || !data.output) {
        console.error('Invalid response format:', data);
        throw new Error('No image was generated');
      }

      console.log('Successfully generated image URL:', data.output);
      const imageUrl = data.output;
      const newVersion: ImageVersion = {
        id: String(versions.length),
        imageUrl,
        prompt,
        timestamp: Date.now()
      };

      setVersions(prevVersions => [...prevVersions, newVersion]);
      setImageUrl(imageUrl);
      
    } catch (error) {
      console.error('Error in handleGenerate:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
      console.error('Error message:', errorMessage);
      alert(errorMessage);
    } finally {
      setIsLoading(false);
      setPrompt('');
      setIsGenerating(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!prompt) return;
    
    setIsEnhancingPrompt(true);
    try {
      const response = await fetch('/api/gemini/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance prompt');
      }

      const { enhancedPrompts } = await response.json();
      setEnhancedPrompts(enhancedPrompts);
      setShowEnhancedPrompts(true);
    } catch (error) {
      console.error('Error enhancing prompt:', error);
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const handleSelectPrompt = (promptText: string) => {
    setPrompt(promptText);
    setShowEnhancedPrompts(false);
  };

  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      canvas.width = THUMBNAIL_WIDTH;
      canvas.height = THUMBNAIL_HEIGHT;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw image with position offset if using move tool
      if (currentTool === 'move') {
        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.drawImage(img, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
      }

      // Draw selection
      if (isSelecting || isEditing) {
        if (currentTool === 'magicWand' && selectedPixels.length > 0) {
          // Draw magic wand selection
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              if (selectedPixels[y][x]) {
                const index = (y * canvas.width + x) * 4;
                imageData.data[index + 3] = Math.min(imageData.data[index + 3] + 100, 255); // Increase alpha
              }
            }
          }
          ctx.putImageData(imageData, 0, 0);
        } else if (currentTool === 'select') {
          // Draw rectangular selection
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          const x = Math.min(selection.x, selection.x + selection.width);
          const y = Math.min(selection.y, selection.y + selection.height);
          const width = Math.abs(selection.width);
          const height = Math.abs(selection.height);
          ctx.strokeRect(x, y, width, height);
        }
      }
    };
  }, [imageUrl, selection, isSelecting, isEditing, currentTool, position, selectedPixels]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            if (!e.shiftKey) handleUndo();
            else handleRedo();
            break;
          case 'y':
            handleRedo();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const previousVersion = history[historyIndex - 1];
      setImageUrl(previousVersion.imageUrl);
      setAdjustments(previousVersion.adjustments || { brightness: 100, contrast: 100 });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const nextVersion = history[historyIndex + 1];
      setImageUrl(nextVersion.imageUrl);
      setAdjustments(nextVersion.adjustments || { brightness: 100, contrast: 100 });
    }
  };

  const addToHistory = (version: ImageVersion) => {
    const newHistory = [...history.slice(0, historyIndex + 1), version];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleCopyImage = async (imageUrl: string) => {
    try {
      // Create a temporary canvas to handle the image
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Enable CORS
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.drawImage(img, 0, 0);
      
      // Convert to blob and copy
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Failed to create blob');
        }
        
        try {
          // Try the modern Clipboard API first
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
        } catch (clipboardError) {
          // Fallback: Create a temporary link and copy URL
          const tempUrl = URL.createObjectURL(blob);
          const tempLink = document.createElement('a');
          tempLink.href = tempUrl;
          tempLink.download = 'image.png';
          document.body.appendChild(tempLink);
          tempLink.click();
          document.body.removeChild(tempLink);
          URL.revokeObjectURL(tempUrl);
        }
      }, 'image/png'); // Use PNG format which is more widely supported
      
    } catch (error) {
      console.error('Error copying image:', error);
      // Fallback to download if copying fails
      handleDownloadImage(imageUrl, 'copied');
    }
  };

  const handleDownloadImage = async (imageUrl: string, versionId: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-image-${versionId}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  // Add YouTube search handler
  const handleYouTubeSearch = async () => {
    if (!searchTerm) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to search YouTube');
      }

      setSearchResults(data.videos || []);
    } catch (error) {
      console.error('Error searching YouTube:', error);
      alert(error instanceof Error ? error.message : 'Failed to search YouTube');
    } finally {
      setIsSearching(false);
    }
  };

  // Add handler to use YouTube thumbnail
  const handleUseThumbnail = async (thumbnailUrl: string) => {
    try {
      const response = await fetch(thumbnailUrl);
      const blob = await response.blob();
      const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
      
      // Use the existing file change handler
      const event = {
        target: {
          files: [file]
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      handleFileChange(event);
    } catch (error) {
      console.error('Error loading thumbnail:', error);
      alert('Failed to load thumbnail');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Add YouTube Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search YouTube videos..."
                  className="w-full px-4 py-2 pr-24 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleYouTubeSearch()}
                />
                <button
                  onClick={handleYouTubeSearch}
                  disabled={isSearching || !searchTerm}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* YouTube Search Results */}
          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {searchResults.map((video, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative group"
                >
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleUseThumbnail(video.thumbnail)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit with AI
                    </button>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium text-gray-800 line-clamp-2">{video.title}</h3>
                    {video.views && (
                      <p className="text-xs text-gray-500">{video.views} views</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          id="image-upload-toolbar"
        />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-6">AI Image Editor</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Main Editor Section */}
            <div className="relative">
              <motion.div
                className="relative rounded-lg overflow-hidden bg-gray-100 aspect-video mb-4"
                onHoverStart={() => setShowFloatingToolbar(true)}
                onHoverEnd={() => setShowFloatingToolbar(false)}
              >
                {imageUrl ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      width={THUMBNAIL_WIDTH}
                      height={THUMBNAIL_HEIGHT}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      className="w-full h-full"
                      style={{
                        filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%)`
                      }}
                    />
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <div className="w-16 h-16 rounded-full bg-purple-100 group-hover:bg-purple-200 transition-colors flex items-center justify-center mb-3">
                        <Upload className="w-8 h-8 text-purple-600" />
                      </div>
                      <p className="text-gray-600 group-hover:text-gray-800 transition-colors">
                        Drop an image or click to upload
                      </p>
                    </label>
                  </div>
                )}
              </motion.div>

              {/* Fixed Toolbar */}
              {imageUrl && (
                <div className="bg-black/75 backdrop-blur-sm rounded-full px-4 py-2 flex items-center justify-center gap-3 mb-4">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 className="w-5 h-5 text-white" />
                  </button>
                  <div className="w-px h-6 bg-white/20" />
                  <button
                    onClick={() => setCurrentTool(currentTool === 'move' ? 'select' : 'move')}
                    className={`p-2 hover:bg-white/10 rounded-full transition-colors ${
                      currentTool === 'move' ? 'bg-white/20' : ''
                    }`}
                    title="Move tool"
                  >
                    <Move className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={() => setCurrentTool(currentTool === 'magicWand' ? 'select' : 'magicWand')}
                    className={`p-2 hover:bg-white/10 rounded-full transition-colors ${
                      currentTool === 'magicWand' ? 'bg-white/20' : ''
                    }`}
                    title="Magic Wand tool"
                  >
                    <Wand2 className="w-5 h-5 text-white" />
                  </button>
                  <div className="w-px h-6 bg-white/20" />
                  <label
                    htmlFor="image-upload-toolbar"
                    className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                    title="Upload new image"
                  >
                    <Upload className="w-5 h-5 text-white" />
                  </label>
                </div>
              )}
            </div>

            {/* Controls Section */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Image Adjustments</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center text-sm text-gray-600">
                        <SunMedium className="w-4 h-4 mr-2" />
                        Brightness
                      </label>
                      <button
                        onClick={() => setAdjustments(prev => ({ ...prev, brightness: 100 }))}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                        title="Reset brightness"
                      >
                        <RotateCcw className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                    <Slider
                      value={adjustments.brightness}
                      onChange={(value) => setAdjustments(prev => ({ ...prev, brightness: value }))}
                      min={0}
                      max={200}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center text-sm text-gray-600">
                        <Contrast className="w-4 h-4 mr-2" />
                        Contrast
                      </label>
                      <button
                        onClick={() => setAdjustments(prev => ({ ...prev, contrast: 100 }))}
                        className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                        title="Reset contrast"
                      >
                        <RotateCcw className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                    <Slider
                      value={adjustments.contrast}
                      onChange={(value) => setAdjustments(prev => ({ ...prev, contrast: value }))}
                      min={0}
                      max={200}
                    />
                  </div>
                </div>
              </div>

              {/* Prompt Input */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">AI Generation</h3>
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the changes you want to make..."
                      className="w-full h-32 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    />
                    <div className="absolute right-2 top-2 flex gap-2">
                      {enhancedPrompts.length > 0 && !showEnhancedPrompts && (
                        <button
                          onClick={() => setShowEnhancedPrompts(true)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Show enhanced prompts"
                        >
                          <ChevronRight className="w-5 h-5 text-purple-600" />
                        </button>
                      )}
                      {prompt && (
                        <button
                          onClick={handleEnhancePrompt}
                          disabled={isEnhancingPrompt}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Enhance prompt with AI"
                        >
                          {isEnhancingPrompt ? (
                            <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-purple-600" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Enhanced Prompts */}
                  <AnimatePresence>
                    {showEnhancedPrompts && enhancedPrompts.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 bg-gray-50 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-semibold text-gray-800">Enhanced Prompts</h4>
                          <button
                            onClick={() => setShowEnhancedPrompts(false)}
                            className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-200 rounded-full transition-colors"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
                          {enhancedPrompts.map((enhancedPrompt, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-100"
                              onClick={() => handleSelectPrompt(enhancedPrompt.prompt)}
                            >
                              <h5 className="text-lg font-bold text-gray-800 mb-3">{enhancedPrompt.title}</h5>
                              <div className="space-y-2">
                                <p className="text-gray-600 text-base leading-relaxed whitespace-pre-wrap">
                                  {enhancedPrompt.prompt}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3">
                    <button
                      onClick={handleEdit}
                      disabled={isLoading || !imageUrl || !prompt}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? 'Editing...' : 'Edit Image'}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isLoading || !prompt}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? 'Generating...' : 'Generate New'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Version History */}
        {versions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8 mt-12"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Version History</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {versions.map((version) => (
                <motion.div
                  key={version.id}
                  layoutId={`version-${version.id}`}
                  className="relative group cursor-pointer"
                >
                  <div 
                    className="aspect-video rounded-lg overflow-hidden"
                    onClick={() => {
                      setImageUrl(version.imageUrl);
                      if (version.adjustments) {
                        setAdjustments(version.adjustments);
                      }
                    }}
                  >
                    <img
                      src={version.imageUrl}
                      alt={`Version ${version.id}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute inset-0 flex items-center justify-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyImage(version.imageUrl);
                        }}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        title="Copy image"
                      >
                        <Copy className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadImage(version.imageUrl, version.id);
                        }}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        title="Download image"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-sm">
                      {new Date(version.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 