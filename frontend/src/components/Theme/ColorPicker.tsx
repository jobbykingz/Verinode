import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Eye, EyeOff, Copy, Check } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  showAlpha?: boolean;
  presetColors?: string[];
}

const defaultPresetColors = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff',
  '#00ff88', '#ff0088', '#88ff00', '#0088ff', '#888888',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
  '#ff9ff3', '#54a0ff', '#48dbfb', '#1dd1a1', '#feca57',
  '#ff6348', '#ff9ff3', '#00d2d3', '#5f27cd', '#00b894',
];

export default function ColorPicker({
  value,
  onChange,
  disabled = false,
  showAlpha = false,
  presetColors = defaultPresetColors,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleColorChange = (newColor: string) => {
    if (!disabled) {
      onChange(newColor);
    }
  };

  const handleCopyColor = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy color:', error);
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  const currentRgb = hexToRgb(value);

  return (
    <div ref={pickerRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 p-2 border rounded-md transition-all ${
          disabled
            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
            : 'bg-white border-gray-300 hover:border-gray-400 cursor-pointer'
        }`}
      >
        <div
          className="w-6 h-6 rounded border border-gray-300"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm font-mono">{value}</span>
        <Palette className="w-4 h-4 text-gray-500" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute z-50 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-xl"
            style={{ minWidth: '280px' }}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="color"
                  value={value}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-16 h-16 border-2 border-gray-300 rounded cursor-pointer"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const hex = e.target.value;
                      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                        handleColorChange(hex);
                      }
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="#000000"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={handleCopyColor}
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                    {currentRgb && (
                      <span className="text-xs text-gray-600">
                        RGB({currentRgb.r}, {currentRgb.g}, {currentRgb.b})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preset Colors</h4>
                <div className="grid grid-cols-8 gap-1">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                        value === color ? 'border-blue-500' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Colors</h4>
                <div className="grid grid-cols-8 gap-1">
                  {JSON.parse(localStorage.getItem('recent-colors') || '[]')
                    .slice(0, 16)
                    .map((color: string) => (
                      <button
                        key={color}
                        onClick={() => handleColorChange(color)}
                        className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                          value === color ? 'border-blue-500' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">RGB Sliders</h4>
                {currentRgb && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-4">R</span>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={currentRgb.r}
                        onChange={(e) => {
                          const r = parseInt(e.target.value);
                          handleColorChange(rgbToHex(r, currentRgb.g, currentRgb.b));
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs w-8 text-right">{currentRgb.r}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-4">G</span>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={currentRgb.g}
                        onChange={(e) => {
                          const g = parseInt(e.target.value);
                          handleColorChange(rgbToHex(currentRgb.r, g, currentRgb.b));
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs w-8 text-right">{currentRgb.g}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-4">B</span>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={currentRgb.b}
                        onChange={(e) => {
                          const b = parseInt(e.target.value);
                          handleColorChange(rgbToHex(currentRgb.r, currentRgb.g, b));
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs w-8 text-right">{currentRgb.b}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
