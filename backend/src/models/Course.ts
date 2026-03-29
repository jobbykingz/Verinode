/**
 * Course Model for Verinode Education Platform
 * Defines the structure and interfaces for course data
 */

export interface Instructor {
  id: string;
  name: string;
  bio: string;
  avatar: string;
  rating: number;
  expertise: string[];
  certifications: string[];
}

export interface CourseMetadata {
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in hours
  language: string;
  subtitle: string;
  prerequisiteProofs: string[]; // IDs of prerequisite proofs/courses
  maxStudents: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  difficulty: number; // 1-10 scale
  estimatedCompletion: number; // in days
  lastUpdated: Date;
  version: string;
}

export interface CourseCategory {
  id: string;
  name: string;
  description: string;
  parentCategory?: string;
  tags: string[];
  icon?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  duration: number;
  content: string;
  resources: string[];
  proofs: string[]; // Related proof IDs
  isRequired: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  instructor: Instructor;
  category: CourseCategory;
  metadata: CourseMetadata;
  modules: CourseModule[];
  tags: string[];
  skills: string[];
  price?: number;
  currency?: string;
  rating: number;
  reviewCount: number;
  enrollmentCount: number;
  completionRate: number;
  thumbnail?: string;
  previewVideo?: string;
  requirements: string[];
  objectives: string[];
  materials: string[];
  certificate: {
    enabled: boolean;
    templateId?: string;
    requirements: string[];
  };
  searchScore?: number; // For search relevance scoring
  featured: boolean;
  status: 'draft' | 'published' | 'archived' | 'deprecated';
  visibility: 'public' | 'private' | 'restricted';
  tenantId?: string;
}

export interface SearchFilter {
  query?: string;
  category?: string;
  level?: string;
  priceRange?: { min: number; max: number };
  duration?: { min: number; max: number };
  language?: string;
  instructor?: string;
  rating?: number;
  tags?: string[];
  skills?: string[];
  tenantId?: string;
  featured?: boolean;
  status?: string;
  sortBy?: 'relevance' | 'rating' | 'price-low' | 'price-high' | 'newest' | 'popular' | 'duration';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  courses: Course[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  searchTime: number;
  suggestions?: string[];
  filters?: {
    categories: CourseCategory[];
    levels: string[];
    languages: string[];
    priceRanges: { min: number; max: number; label: string }[];
  };
}

export interface SearchAnalytics {
  id: string;
  query: string;
  filters: SearchFilter;
  resultCount: number;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  processingTime: number;
  clickedResults: string[];
  conversionRate?: number;
  userSatisfaction?: number;
  aiFeaturesUsed?: string[];
  searchType: 'traditional' | 'ai-powered' | 'hybrid';
}

export interface CourseProgress {
  userId: string;
  courseId: string;
  completedModules: string[];
  currentModule?: string;
  progress: number; // 0-100 percentage
  timeSpent: number; // in minutes
  lastAccessed: Date;
  startedAt: Date;
  completedAt?: Date;
  certificates: string[];
  achievements: string[];
}

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  pros: string[];
  cons: string[];
  helpful: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: Date;
  status: 'active' | 'completed' | 'dropped' | 'paused';
  progress: CourseProgress;
  payment?: {
    amount: number;
    currency: string;
    method: string;
    transactionId: string;
    paidAt: Date;
  };
  certificates: string[];
  lastAccessed: Date;
}

// Search-specific interfaces for AI integration
export interface CourseSearchDocument {
  id: string;
  title: string;
  description: string;
  content: string; // Combined searchable content
  tags: string[];
  skills: string[];
  category: string;
  level: string;
  instructor: string;
  language: string;
  price: number;
  rating: number;
  popularity: number;
  createdAt: Date;
  updatedAt: Date;
  embedding?: number[]; // Vector embedding for semantic search
}

export interface SearchSuggestion {
  text: string;
  type: 'course' | 'skill' | 'instructor' | 'category' | 'query';
  confidence: number;
  metadata?: {
    courseId?: string;
    category?: string;
    popularity?: number;
  };
}

export interface SearchIntent {
  type: 'course_search' | 'skill_search' | 'career_path' | 'comparison' | 'recommendation' | 'filter_query';
  confidence: number;
  entities: {
    skills?: string[];
    level?: string;
    category?: string;
    price_range?: { min: number; max: number };
    duration?: { min: number; max: number };
    language?: string;
    instructor?: string;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
}

// Analytics and metrics interfaces
export interface CourseMetrics {
  courseId: string;
  views: number;
  enrollments: number;
  completions: number;
  averageRating: number;
  averageCompletionTime: number;
  revenue: number;
  engagementScore: number;
  retentionRate: number;
  lastUpdated: Date;
}

export interface SearchMetrics {
  totalSearches: number;
  uniqueQueries: number;
  averageResults: number;
  averageSearchTime: number;
  conversionRate: number;
  popularQueries: Array<{ query: string; count: number }>;
  searchTrends: Array<{ date: string; searches: number }>;
  aiFeatureUsage: { [feature: string]: number };
}

export default {
  Course,
  Instructor,
  CourseMetadata,
  CourseCategory,
  CourseModule,
  SearchFilter,
  SearchResult,
  SearchAnalytics,
  CourseProgress,
  CourseReview,
  CourseEnrollment,
  CourseSearchDocument,
  SearchSuggestion,
  SearchIntent,
  CourseMetrics,
  SearchMetrics
};
