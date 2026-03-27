import axios from 'axios';
import { FormTemplate, FormSubmission, FormAnalytics, FormField } from '../types/formBuilder';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class FormBuilderService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  // Form Template Operations
  async createTemplate(template: Omit<FormTemplate, 'id' | 'metadata'>): Promise<FormTemplate> {
    const response = await this.api.post('/form-templates', template);
    return response.data;
  }

  async updateTemplate(id: string, template: Partial<FormTemplate>): Promise<FormTemplate> {
    const response = await this.api.put(`/form-templates/${id}`, template);
    return response.data;
  }

  async getTemplate(id: string): Promise<FormTemplate> {
    const response = await this.api.get(`/form-templates/${id}`);
    return response.data;
  }

  async getTemplates(filters?: {
    category?: string;
    isPublic?: boolean;
    tags?: string[];
    page?: number;
    limit?: number;
  }): Promise<{ templates: FormTemplate[]; total: number }> {
    const response = await this.api.get('/form-templates', { params: filters });
    return response.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.api.delete(`/form-templates/${id}`);
  }

  async duplicateTemplate(id: string, newName: string): Promise<FormTemplate> {
    const response = await this.api.post(`/form-templates/${id}/duplicate`, { name: newName });
    return response.data;
  }

  // Form Submission Operations
  async submitForm(templateId: string, data: Record<string, any>): Promise<FormSubmission> {
    const response = await this.api.post(`/form-templates/${templateId}/submit`, { data });
    return response.data;
  }

  async getSubmissions(templateId: string, filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ submissions: FormSubmission[]; total: number }> {
    const response = await this.api.get(`/form-templates/${templateId}/submissions`, { params: filters });
    return response.data;
  }

  async getSubmission(id: string): Promise<FormSubmission> {
    const response = await this.api.get(`/form-submissions/${id}`);
    return response.data;
  }

  async updateSubmissionStatus(id: string, status: FormSubmission['status']): Promise<FormSubmission> {
    const response = await this.api.patch(`/form-submissions/${id}/status`, { status });
    return response.data;
  }

  // Analytics Operations
  async getAnalytics(templateId: string): Promise<FormAnalytics> {
    const response = await this.api.get(`/form-templates/${templateId}/analytics`);
    return response.data;
  }

  async getUsageStats(templateId: string, period: 'day' | 'week' | 'month'): Promise<any> {
    const response = await this.api.get(`/form-templates/${templateId}/usage`, { params: { period } });
    return response.data;
  }

  // Export/Import Operations
  async exportTemplate(id: string, format: 'json' | 'yaml' | 'csv'): Promise<Blob> {
    const response = await this.api.get(`/form-templates/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  }

  async importTemplate(file: File): Promise<FormTemplate> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.api.post('/form-templates/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Validation Operations
  async validateField(field: FormField, value: any): Promise<{ isValid: boolean; errors: string[] }> {
    const response = await this.api.post('/validation/field', { field, value });
    return response.data;
  }

  async validateForm(fields: FormField[], data: Record<string, any>): Promise<{
    isValid: boolean;
    errors: Record<string, string[]>;
  }> {
    const response = await this.api.post('/validation/form', { fields, data });
    return response.data;
  }

  // File Upload Operations
  async uploadFile(file: File, fieldId: string): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fieldId', fieldId);
    
    const response = await this.api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteFile(filename: string): Promise<void> {
    await this.api.delete(`/files/${filename}`);
  }

  // Template Sharing Operations
  async shareTemplate(id: string, options: {
    isPublic: boolean;
    allowCopy: boolean;
    expiresAt?: string;
  }): Promise<{ shareUrl: string; shareId: string }> {
    const response = await this.api.post(`/form-templates/${id}/share`, options);
    return response.data;
  }

  async getSharedTemplate(shareId: string): Promise<FormTemplate> {
    const response = await this.api.get(`/shared-templates/${shareId}`);
    return response.data;
  }

  // Auto-save Operations
  async autoSaveTemplate(template: FormTemplate): Promise<void> {
    await this.api.post('/form-templates/autosave', template);
  }

  async getAutoSavedTemplate(): Promise<FormTemplate | null> {
    const response = await this.api.get('/form-templates/autosave');
    return response.data;
  }

  // Template Versioning
  async createTemplateVersion(id: string): Promise<FormTemplate> {
    const response = await this.api.post(`/form-templates/${id}/versions`);
    return response.data;
  }

  async getTemplateVersions(id: string): Promise<FormTemplate[]> {
    const response = await this.api.get(`/form-templates/${id}/versions`);
    return response.data;
  }

  async restoreTemplateVersion(id: string, versionId: string): Promise<FormTemplate> {
    const response = await this.api.post(`/form-templates/${id}/versions/${versionId}/restore`);
    return response.data;
  }

  // Search and Discovery
  async searchTemplates(query: string, filters?: {
    category?: string;
    tags?: string[];
    fieldType?: string;
  }): Promise<FormTemplate[]> {
    const response = await this.api.get('/form-templates/search', {
      params: { query, ...filters },
    });
    return response.data;
  }

  async getPopularTemplates(limit: number = 10): Promise<FormTemplate[]> {
    const response = await this.api.get('/form-templates/popular', { params: { limit } });
    return response.data;
  }

  async getRecentTemplates(limit: number = 10): Promise<FormTemplate[]> {
    const response = await this.api.get('/form-templates/recent', { params: { limit } });
    return response.data;
  }
}

export default FormBuilderService;
