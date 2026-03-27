import { UsageTrend } from '../models/BusinessMetrics';

export class UsageTrendsAnalyzer {
  
  async analyzeGrowthPatterns(timeframe: string = '30d'): Promise<{
    dailyGrowth: UsageTrend[];
    weeklyGrowth: UsageTrend[];
    monthlyGrowth: UsageTrend[];
    growthRate: number;
    projections: UsageTrend[];
  }> {
    // Implementation would analyze actual usage data
    const dailyGrowth = this.generateMockTrends('daily', parseInt(timeframe));
    const weeklyGrowth = this.generateMockTrends('weekly', Math.ceil(parseInt(timeframe) / 7));
    const monthlyGrowth = this.generateMockTrends('monthly', Math.ceil(parseInt(timeframe) / 30));
    
    const growthRate = this.calculateGrowthRate(dailyGrowth);
    const projections = this.generateProjections(dailyGrowth, 30);
    
    return {
      dailyGrowth,
      weeklyGrowth,
      monthlyGrowth,
      growthRate,
      projections
    };
  }

  async getPeakUsageTimes(timeframe: string = '30d'): Promise<{
    hourlyPeaks: { hour: number; usage: number }[];
    dailyPeaks: { day: string; usage: number }[];
    seasonalPatterns: { season: string; usage: number }[];
  }> {
    const hourlyPeaks = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      usage: Math.floor(Math.random() * 1000) + 100
    })).sort((a, b) => b.usage - a.usage).slice(0, 5);

    const dailyPeaks = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({
      day,
      usage: Math.floor(Math.random() * 5000) + 1000
    })).sort((a, b) => b.usage - a.usage);

    const seasonalPatterns = ['Spring', 'Summer', 'Fall', 'Winter'].map(season => ({
      season,
      usage: Math.floor(Math.random() * 10000) + 5000
    }));

    return {
      hourlyPeaks,
      dailyPeaks,
      seasonalPatterns
    };
  }

  async getFeatureAdoptionRates(): Promise<{
    features: { name: string; adoptionRate: number; totalUsers: number; newUsers: number }[];
    trends: { feature: string; trend: 'up' | 'down' | 'stable'; change: number }[];
  }> {
    const features = [
      'Proof Creation',
      'Verification',
      'Analytics Dashboard',
      'Team Management',
      'Enterprise Features',
      'API Access',
      'Mobile App',
      'Integrations'
    ].map(name => ({
      name,
      adoptionRate: Math.random() * 100,
      totalUsers: Math.floor(Math.random() * 10000) + 1000,
      newUsers: Math.floor(Math.random() * 500) + 50
    }));

    const trends = features.map(feature => ({
      feature: feature.name,
      trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
      change: Math.random() * 20 - 10
    }));

    return { features, trends };
  }

  private generateMockTrends(granularity: string, count: number): UsageTrend[] {
    const trends: UsageTrend[] = [];
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now);
      
      if (granularity === 'daily') {
        date.setDate(date.getDate() - i);
      } else if (granularity === 'weekly') {
        date.setDate(date.getDate() - (i * 7));
      } else if (granularity === 'monthly') {
        date.setMonth(date.getMonth() - i);
      }
      
      trends.push({
        date,
        metric: 'usage',
        value: Math.floor(Math.random() * 1000) + 500,
        change: Math.random() * 100 - 50,
        changePercent: Math.random() * 20 - 10,
        forecast: Math.floor(Math.random() * 1000) + 500
      });
    }
    
    return trends;
  }

  private calculateGrowthRate(trends: UsageTrend[]): number {
    if (trends.length < 2) return 0;
    
    const firstValue = trends[0].value;
    const lastValue = trends[trends.length - 1].value;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }

  private generateProjections(historicalData: UsageTrend[], days: number): UsageTrend[] {
    const projections: UsageTrend[] = [];
    const lastValue = historicalData[historicalData.length - 1]?.value || 1000;
    const growthRate = this.calculateGrowthRate(historicalData) / 100;
    
    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const projectedValue = lastValue * Math.pow(1 + growthRate, i / 30);
      
      projections.push({
        date,
        metric: 'usage',
        value: projectedValue,
        change: projectedValue - lastValue,
        changePercent: ((projectedValue - lastValue) / lastValue) * 100,
        forecast: projectedValue
      });
    }
    
    return projections;
  }
}
