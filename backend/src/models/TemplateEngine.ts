import { NotificationTemplate } from '../models/Notification';

export class TemplateEngine {
  private templates: Map<string, NotificationTemplate> = new Map();

  public registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  public getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  public render(templateId: string, data: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    let rendered = template.body;
    for (const [key, value] of Object.entries(data)) {
      // Simple handlebars-like replacement {{key}}
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }
}