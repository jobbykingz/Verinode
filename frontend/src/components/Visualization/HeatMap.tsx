import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { Calendar, Filter, Download, Maximize2, Grid3X3 } from 'lucide-react';

interface HeatMapData {
  x: string;
  y: string;
  value: number;
  category?: string;
  metadata?: Record<string, any>;
}

interface HeatMapProps {
  className?: string;
  data?: HeatMapData[];
  width?: number;
  height?: number;
  colorScheme?: 'blues' | 'reds' | 'greens' | 'viridis' | 'plasma';
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  valueLabel?: string;
  onCellClick?: (data: HeatMapData) => void;
  onCellHover?: (data: HeatMapData | null) => void;
  showTooltip?: boolean;
  showLegend?: boolean;
  interactive?: boolean;
}

const HeatMap: React.FC<HeatMapProps> = ({
  className = '',
  data,
  width = 800,
  height = 400,
  colorScheme = 'blues',
  title = 'Heat Map',
  xAxisLabel = 'X Axis',
  yAxisLabel = 'Y Axis',
  valueLabel = 'Value',
  onCellClick,
  onCellHover,
  showTooltip = true,
  showLegend = true,
  interactive = true,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [heatMapData, setHeatMapData] = useState<HeatMapData[]>([]);
  const [hoveredCell, setHoveredCell] = useState<HeatMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width, height });

  // Color schemes
  const colorSchemes = {
    blues: d3.scaleSequential(d3.interpolateBlues),
    reds: d3.scaleSequential(d3.interpolateReds),
    greens: d3.scaleSequential(d3.interpolateGreens),
    viridis: d3.scaleSequential(d3.interpolateViridis),
    plasma: d3.scaleSequential(d3.interpolatePlasma),
  };

  // Mock data generation - replace with actual API calls
  const generateMockData = useMemo(() => {
    const mockData: HeatMapData[] = [];
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    days.forEach(day => {
      hours.forEach(hour => {
        mockData.push({
          x: hour,
          y: day,
          value: Math.floor(Math.random() * 100),
          category: 'activity',
          metadata: {
            timestamp: `${day} ${hour}`,
            description: `Activity level at ${hour} on ${day}`,
          },
        });
      });
    });
    
    return mockData;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalData = data || generateMockData;
      setHeatMapData(finalData);
      setIsLoading(false);
    };

    loadData();
  }, [data, generateMockData]);

  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        const { width: containerWidth } = container.getBoundingClientRect();
        setDimensions({
          width: Math.min(containerWidth - 32, width),
          height,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  useEffect(() => {
    if (!svgRef.current || heatMapData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 60, right: 120, bottom: 60, left: 80 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const g = svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get unique x and y values
    const xValues = Array.from(new Set(heatMapData.map(d => d.x))).sort();
    const yValues = Array.from(new Set(heatMapData.map(d => d.y))).sort();

    // Create scales
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([0, innerHeight])
      .padding(0.1);

    // Create color scale
    const colorScale = colorSchemes[colorScheme];
    const maxValue = d3.max(heatMapData, d => d.value) || 100;
    const minValue = d3.min(heatMapData, d => d.value) || 0;
    colorScale.domain([minValue, maxValue]);

    // Create cells
    const cells = g.selectAll('.cell')
      .data(heatMapData)
      .enter()
      .append('g')
      .attr('class', 'cell');

    cells.append('rect')
      .attr('x', d => xScale(d.x) || 0)
      .attr('y', d => yScale(d.y) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', interactive ? 'pointer' : 'default')
      .on('click', (event, d) => {
        if (interactive && onCellClick) {
          onCellClick(d);
        }
      })
      .on('mouseover', (event, d) => {
        if (interactive) {
          d3.select(event.target)
            .attr('stroke', '#333')
            .attr('stroke-width', 3);
          setHoveredCell(d);
          onCellHover?.(d);
        }
      })
      .on('mouseout', (event, d) => {
        if (interactive) {
          d3.select(event.target)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
          setHoveredCell(null);
          onCellHover?.(null);
        }
      });

    // Add value labels on cells (if space permits)
    if (xScale.bandwidth() > 30 && yScale.bandwidth() > 30) {
      cells.append('text')
        .attr('x', d => (xScale(d.x) || 0) + xScale.bandwidth() / 2)
        .attr('y', d => (yScale(d.y) || 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', d => d.value > maxValue * 0.6 ? '#fff' : '#333')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .text(d => d.value.toString());
    }

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(yAxisLabel);

    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(xAxisLabel);

    // Add title
    svg.append('text')
      .attr('x', dimensions.width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text(title);

    // Add legend
    if (showLegend) {
      const legendWidth = 20;
      const legendHeight = innerHeight;
      const legendX = dimensions.width - margin.right + 20;
      const legendY = margin.top;

      const legendScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([legendHeight, 0]);

      const legendAxis = d3.axisRight(legendScale)
        .ticks(10)
        .tickFormat(d3.format('.0f'));

      // Legend gradient
      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '100%')
        .attr('x2', '0%')
        .attr('y2', '0%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colorScale(minValue));

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colorScale(maxValue));

      svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)')
        .style('stroke', '#000')
        .style('stroke-width', 1);

      svg.append('g')
        .attr('transform', `translate(${legendX + legendWidth}, ${legendY})`)
        .call(legendAxis);

      svg.append('text')
        .attr('x', legendX + legendWidth / 2)
        .attr('y', legendY - 10)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(valueLabel);
    }

  }, [heatMapData, dimensions, colorScheme, title, xAxisLabel, yAxisLabel, valueLabel, showLegend, interactive, onCellClick, onCellHover]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={colorScheme}
            onChange={(e) => {/* Handle color scheme change */}}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="blues">Blues</option>
            <option value="reds">Reds</option>
            <option value="greens">Greens</option>
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
          </select>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Maximize2 className="w-4 h-4" />
            Fullscreen
          </button>
        </div>
      </div>

      {/* Heat Map Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
      >
        <div className="relative">
          <svg ref={svgRef} className="w-full"></svg>
          
          {/* Tooltip */}
          {showTooltip && hoveredCell && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute z-10 bg-gray-900 text-white p-3 rounded-lg shadow-lg pointer-events-none"
              style={{
                left: '50%',
                top: '10px',
                transform: 'translateX(-50%)',
              }}
            >
              <div className="text-sm font-semibold">{hoveredCell.metadata?.timestamp}</div>
              <div className="text-lg font-bold">{hoveredCell.value}</div>
              <div className="text-xs text-gray-300">{hoveredCell.metadata?.description}</div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Min Value</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {Math.min(...heatMapData.map(d => d.value)).toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Value</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {Math.max(...heatMapData.map(d => d.value)).toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Average</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {(heatMapData.reduce((sum, d) => sum + d.value, 0) / heatMapData.length).toFixed(1)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cells</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {heatMapData.length.toLocaleString()}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HeatMap;
