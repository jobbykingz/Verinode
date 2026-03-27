import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler,
} from 'chart.js';
import {
  Line,
  Bar,
  Pie,
  Doughnut,
  Radar,
  PolarArea,
  Scatter,
  Bubble,
} from 'react-chartjs-2';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
);

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
    pointRadius?: number;
    pointHoverRadius?: number;
  }>;
}

export interface ChartProps {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble';
  data: ChartData;
  options?: any;
  width?: number;
  height?: number;
  responsive?: boolean;
  className?: string;
  onDataPointClick?: (data: any) => void;
  theme?: 'light' | 'dark';
  animationDuration?: number;
}

const defaultTheme = {
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.8)',
    textColor: '#374151',
    gridColor: 'rgba(229, 231, 235, 0.5)',
  },
  dark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.8)',
    textColor: '#E5E7EB',
    gridColor: 'rgba(75, 85, 99, 0.3)',
  },
};

const ChartLibrary: React.FC<ChartProps> = ({
  type,
  data,
  options = {},
  width = 400,
  height = 300,
  responsive = true,
  className = '',
  onDataPointClick,
  theme = 'light',
  animationDuration = 1000,
}) => {
  const chartRef = useRef<any>(null);
  const [isInteractive, setIsInteractive] = useState(true);
  const [hoveredData, setHoveredData] = useState<any>(null);

  const currentTheme = defaultTheme[theme];

  const defaultOptions = {
    responsive,
    maintainAspectRatio: false,
    animation: {
      duration: animationDuration,
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: currentTheme.textColor,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: currentTheme.borderColor,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US').format(context.parsed.y);
            }
            return label;
          },
        },
      },
    },
    scales: type !== 'pie' && type !== 'doughnut' && type !== 'radar' && type !== 'polarArea' ? {
      x: {
        grid: {
          color: currentTheme.gridColor,
          drawBorder: false,
        },
        ticks: {
          color: currentTheme.textColor,
        },
      },
      y: {
        grid: {
          color: currentTheme.gridColor,
          drawBorder: false,
        },
        ticks: {
          color: currentTheme.textColor,
        },
      },
    } : undefined,
    onClick: (event: any, elements: any[]) => {
      if (onDataPointClick && elements.length > 0) {
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        const index = element.index;
        const value = data.datasets[datasetIndex].data[index];
        const label = data.labels[index];
        onDataPointClick({ label, value, datasetIndex, index });
      }
    },
    onHover: (event: any, elements: any[]) => {
      if (elements.length > 0) {
        const element = elements[0];
        const datasetIndex = element.datasetIndex;
        const index = element.index;
        const value = data.datasets[datasetIndex].data[index];
        const label = data.labels[index];
        setHoveredData({ label, value, datasetIndex, index });
      } else {
        setHoveredData(null);
      }
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const renderChart = () => {
    const commonProps = {
      ref: chartRef,
      data,
      options: mergedOptions,
      className,
    };

    switch (type) {
      case 'line':
        return <Line {...commonProps} />;
      case 'bar':
        return <Bar {...commonProps} />;
      case 'pie':
        return <Pie {...commonProps} />;
      case 'doughnut':
        return <Doughnut {...commonProps} />;
      case 'radar':
        return <Radar {...commonProps} />;
      case 'polarArea':
        return <PolarArea {...commonProps} />;
      case 'scatter':
        return <Scatter {...commonProps} />;
      case 'bubble':
        return <Bubble {...commonProps} />;
      default:
        return <Line {...commonProps} />;
    }
  };

  const exportChart = useCallback(() => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `chart-${type}-${Date.now()}.png`;
      link.href = url;
      link.click();
    }
  }, [type]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        exportChart();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [exportChart]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative ${className}`}
      style={{ width, height }}
      role="img"
      aria-label={`${type} chart showing ${data.labels.length} data points`}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={exportChart}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          aria-label="Export chart as image"
          title="Export chart (Ctrl+S)"
        >
          <svg
            className="w-4 h-4 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>
        <button
          onClick={() => setIsInteractive(!isInteractive)}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          aria-label="Toggle interactivity"
          title="Toggle interactivity"
        >
          <svg
            className="w-4 h-4 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 15l-2 5L9 9l11 4-5 2z"
            />
          </svg>
        </button>
      </div>

      {hoveredData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-2 left-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg z-10"
        >
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {hoveredData.label}
          </p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {new Intl.NumberFormat('en-US').format(hoveredData.value)}
          </p>
        </motion.div>
      )}

      <div className="w-full h-full">
        {renderChart()}
      </div>
    </motion.div>
  );
};

export default ChartLibrary;
