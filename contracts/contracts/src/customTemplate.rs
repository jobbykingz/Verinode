// Custom Template Smart Contract for Verinode
// This contract handles template validation and storage on the Stellar network

#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, Map, String, Vec, symbol_short};

// Template field definition
#[contracttype]
#[derive(Clone)]
pub struct TemplateField {
    pub id: String,
    pub name: String,
    pub field_type: String,
    pub label: String,
    pub description: Option<String>,
    pub required: bool,
    pub default_value: Option<String>,
    pub placeholder: Option<String>,
    pub options: Option<Vec<String>>,
    pub min_length: Option<u32>,
    pub max_length: Option<u32>,
    pub min_value: Option<i64>,
    pub max_value: Option<i64>,
    pub pattern: Option<String>,
    pub help_text: Option<String>,
    pub order: u32,
    pub visible: bool,
    pub editable: bool,
}

// Validation rule definition
#[contracttype]
#[derive(Clone)]
pub struct ValidationRule {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub field_id: String,
    pub rule_type: String,
    pub parameters: Option<Map<String, String>>,
    pub error_message: String,
    pub severity: String,
    pub enabled: bool,
}

// Template layout definition
#[contracttype]
#[derive(Clone)]
pub struct TemplateLayout {
    pub sections: Vec<TemplateSection>,
    pub theme: TemplateTheme,
}

#[contracttype]
#[derive(Clone)]
pub struct TemplateSection {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub fields: Vec<SectionField>,
    pub order: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct SectionField {
    pub field_id: String,
    pub width: String,
}

#[contracttype]
#[derive(Clone)]
pub struct TemplateTheme {
    pub primary_color: String,
    pub secondary_color: String,
    pub background_color: String,
    pub text_color: String,
}

// Custom template definition
#[contracttype]
#[derive(Clone)]
pub struct CustomTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub category: String,
    pub fields: Vec<TemplateField>,
    pub validation_rules: Vec<ValidationRule>,
    pub layout: TemplateLayout,
    pub template_schema: Bytes,
    pub sample_data: Option<Bytes>,
    pub created_by: Address,
    pub organization_id: Option<String>,
    pub is_public: bool,
    pub tags: Vec<String>,
    pub price: i128,
    pub usage_count: u64,
    pub status: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub requires_encryption: bool,
    pub privacy_level: String,
}

// Template metadata for marketplace
#[contracttype]
#[derive(Clone)]
pub struct TemplateMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub created_by: Address,
    pub is_public: bool,
    pub price: i128,
    pub usage_count: u64,
    pub rating_average: Option<i64>,
    pub rating_count: u64,
    pub status: String,
    pub created_at: u64,
    pub tags: Vec<String>,
}

// Contract storage keys
const TEMPLATES: Symbol = symbol_short!("TEMPLATES");
const TEMPLATE_COUNT: Symbol = symbol_short!("TPL_COUNT");
const USER_TEMPLATES: Symbol = symbol_short!("USR_TPLS");

#[contract]
pub struct CustomTemplateContract;

#[contractimpl]
impl CustomTemplateContract {
    /// Initialize the contract
    pub fn initialize(e: Env) {
        if e.storage().instance().has(&TEMPLATE_COUNT) {
            panic!("Contract already initialized");
        }
        e.storage().instance().set(&TEMPLATE_COUNT, &0u64);
    }

    /// Create a new custom template
    pub fn create_template(
        e: Env,
        name: String,
        description: String,
        category: String,
        fields: Vec<TemplateField>,
        validation_rules: Vec<ValidationRule>,
        layout: TemplateLayout,
        template_schema: Bytes,
        sample_data: Option<Bytes>,
        is_public: bool,
        tags: Vec<String>,
        price: i128,
        requires_encryption: bool,
        privacy_level: String,
    ) -> String {
        let creator = e.invoker();
        let template_count: u64 = e.storage().instance().get(&TEMPLATE_COUNT).unwrap_or(0);
        let template_id = format!("tpl_{}", template_count);
        
        let template = CustomTemplate {
            id: template_id.clone(),
            name,
            description,
            version: String::from_str(&e, "1.0.0"),
            category,
            fields,
            validation_rules,
            layout,
            template_schema,
            sample_data,
            created_by: creator,
            organization_id: None,
            is_public,
            tags,
            price,
            usage_count: 0,
            status: String::from_str(&e, "draft"),
            created_at: e.ledger().timestamp(),
            updated_at: e.ledger().timestamp(),
            requires_encryption,
            privacy_level,
        };

        // Store the template
        let mut templates: Map<String, CustomTemplate> = e.storage().persistent().get(&TEMPLATES).unwrap_or(Map::new(&e));
        templates.set(template_id.clone(), template);
        e.storage().persistent().set(&TEMPLATES, &templates);

        // Update user templates list
        let mut user_templates: Map<String, Vec<String>> = e.storage().persistent().get(&USER_TEMPLATES).unwrap_or(Map::new(&e));
        let mut user_template_list = user_templates.get(creator.clone()).unwrap_or(Vec::new(&e));
        user_template_list.push_back(template_id.clone());
        user_templates.set(creator, user_template_list);
        e.storage().persistent().set(&USER_TEMPLATES, &user_templates);

        // Increment template count
        e.storage().instance().set(&TEMPLATE_COUNT, &(template_count + 1));

        template_id
    }

    /// Get template by ID
    pub fn get_template(e: Env, template_id: String) -> Option<CustomTemplate> {
        let templates: Map<String, CustomTemplate> = e.storage().persistent().get(&TEMPLATES)?;
        templates.get(template_id)
    }

    /// List templates with filters
    pub fn list_templates(
        e: Env,
        category: Option<String>,
        is_public: Option<bool>,
        tags: Option<Vec<String>>,
        limit: Option<u32>,
    ) -> Vec<TemplateMetadata> {
        let templates: Map<String, CustomTemplate> = e.storage().persistent().get(&TEMPLATES).unwrap_or(Map::new(&e));
        let mut result = Vec::new(&e);
        let limit = limit.unwrap_or(50).min(100);

        let mut count = 0u32;
        for (id, template) in templates.iter() {
            if count >= limit {
                break;
            }

            // Apply filters
            let mut include = true;
            
            if let Some(ref cat) = category {
                if template.category != *cat {
                    include = false;
                }
            }
            
            if let Some(public) = is_public {
                if template.is_public != public {
                    include = false;
                }
            }
            
            if let Some(ref tag_list) = tags {
                let template_tags = template.tags;
                let mut has_tag = false;
                for tag in tag_list.iter() {
                    if template_tags.contains(tag) {
                        has_tag = true;
                        break;
                    }
                }
                if !has_tag {
                    include = false;
                }
            }

            // Only include approved templates for public listing
            if is_public.unwrap_or(true) && template.status != String::from_str(&e, "approved") {
                include = false;
            }

            if include {
                let metadata = TemplateMetadata {
                    id: template.id,
                    name: template.name,
                    description: template.description,
                    category: template.category,
                    created_by: template.created_by,
                    is_public: template.is_public,
                    price: template.price,
                    usage_count: template.usage_count,
                    rating_average: None, // Would be calculated from ratings
                    rating_count: 0,
                    status: template.status,
                    created_at: template.created_at,
                    tags: template.tags,
                };
                result.push_back(metadata);
                count += 1;
            }
        }

        result
    }

    /// Update template (only by creator)
    pub fn update_template(
        e: Env,
        template_id: String,
        name: Option<String>,
        description: Option<String>,
        category: Option<String>,
        fields: Option<Vec<TemplateField>>,
        validation_rules: Option<Vec<ValidationRule>>,
        layout: Option<TemplateLayout>,
        template_schema: Option<Bytes>,
        sample_data: Option<Bytes>,
        is_public: Option<bool>,
        tags: Option<Vec<String>>,
        price: Option<i128>,
        requires_encryption: Option<bool>,
        privacy_level: Option<String>,
    ) -> bool {
        let creator = e.invoker();
        let mut templates: Map<String, CustomTemplate> = e.storage().persistent().get(&TEMPLATES).unwrap_or(Map::new(&e));
        
        if let Some(mut template) = templates.get(template_id.clone()) {
            // Check ownership
            if template.created_by != creator {
                panic!("Unauthorized: You can only update your own templates");
            }

            // Only allow updates to draft templates
            if template.status != String::from_str(&e, "draft") {
                panic!("Only draft templates can be updated");
            }

            // Update fields
            if let Some(n) = name {
                template.name = n;
            }
            if let Some(d) = description {
                template.description = d;
            }
            if let Some(c) = category {
                template.category = c;
            }
            if let Some(f) = fields {
                template.fields = f;
            }
            if let Some(v) = validation_rules {
                template.validation_rules = v;
            }
            if let Some(l) = layout {
                template.layout = l;
            }
            if let Some(s) = template_schema {
                template.template_schema = s;
            }
            if let Some(s) = sample_data {
                template.sample_data = Some(s);
            }
            if let Some(p) = is_public {
                template.is_public = p;
            }
            if let Some(t) = tags {
                template.tags = t;
            }
            if let Some(p) = price {
                template.price = p;
            }
            if let Some(r) = requires_encryption {
                template.requires_encryption = r;
            }
            if let Some(p) = privacy_level {
                template.privacy_level = p;
            }

            template.updated_at = e.ledger().timestamp();
            template.status = String::from_str(&e, "draft"); // Reset to draft

            // Save updated template
            templates.set(template_id, template);
            e.storage().persistent().set(&TEMPLATES, &templates);
            
            true
        } else {
            false
        }
    }

    /// Submit template for approval
    pub fn submit_for_approval(e: Env, template_id: String) -> bool {
        let creator = e.invoker();
        let mut templates: Map<String, CustomTemplate> = e.storage().persistent().get(&TEMPLATES).unwrap_or(Map::new(&e));
        
        if let Some(mut template) = templates.get(template_id.clone()) {
            // Check ownership
            if template.created_by != creator {
                panic!("Unauthorized: You can only submit your own templates");
            }

            // Check status
            if template.status != String::from_str(&e, "draft") {
                panic!("Template must be in draft status to submit for approval");
            }

            // Validate template
            if !Self::validate_template_structure(&e, &template) {
                panic!("Template validation failed");
            }

            template.status = String::from_str(&e, "pending");
            template.updated_at = e.ledger().timestamp();

            templates.set(template_id, template);
            e.storage().persistent().set(&TEMPLATES, &templates);
            
            true
        } else {
            false
        }
    }

    /// Moderate template (admin function)
    pub fn moderate_template(e: Env, template_id: String, decision: String, rejection_reason: Option<String>) -> bool {
        // In a real implementation, you would check admin permissions here
        let moderator = e.invoker();
        
        let mut templates: Map<String, CustomTemplate> = e.storage().persistent().get(&TEMPLATES).unwrap_or(Map::new(&e));
        
        if let Some(mut template) = templates.get(template_id.clone()) {
            // Check if template is pending
            if template.status != String::from_str(&e, "pending") {
                panic!("Template is not pending approval");
            }

            if decision == String::from_str(&e, "approve") {
                template.status = String::from_str(&e, "approved");
            } else if decision == String::from_str(&e, "reject") {
                template.status = String::from_str(&e, "rejected");
                // Store rejection reason in a separate field or log
            } else {
                panic!("Invalid decision. Must be 'approve' or 'reject'");
            }

            template.updated_at = e.ledger().timestamp();

            templates.set(template_id, template);
            e.storage().persistent().set(&TEMPLATES, &templates);
            
            true
        } else {
            false
        }
    }

    /// Get user's templates
    pub fn get_user_templates(e: Env, user: Address) -> Vec<String> {
        let user_templates: Map<String, Vec<String>> = e.storage().persistent().get(&USER_TEMPLATES).unwrap_or(Map::new(&e));
        user_templates.get(user).unwrap_or(Vec::new(&e))
    }

    /// Validate template data against template schema
    pub fn validate_template_data(e: Env, template_id: String, data: Map<String, String>) -> bool {
        let templates: Map<String, CustomTemplate> = e.storage().persistent().get(&TEMPLATES).unwrap_or(Map::new(&e));
        
        if let Some(template) = templates.get(template_id) {
            Self::validate_data_against_template(&e, &template, &data)
        } else {
            false
        }
    }

    /// Helper function to validate template structure
    fn validate_template_structure(e: &Env, template: &CustomTemplate) -> bool {
        // Check required fields
        if template.name.is_empty() || template.description.is_empty() {
            return false;
        }

        // Validate field IDs are unique
        let mut field_ids = Vec::new(&e);
        for field in template.fields.iter() {
            if field_ids.contains(&field.id) {
                return false;
            }
            field_ids.push_back(field.id.clone());
        }

        // Validate validation rules reference existing fields
        for rule in template.validation_rules.iter() {
            let mut field_exists = false;
            for field in template.fields.iter() {
                if field.id == rule.field_id {
                    field_exists = true;
                    break;
                }
            }
            if !field_exists {
                return false;
            }
        }

        true
    }

    /// Helper function to validate data against template
    fn validate_data_against_template(e: &Env, template: &CustomTemplate, data: &Map<String, String>) -> bool {
        // Validate required fields
        for field in template.fields.iter() {
            if field.required {
                if !data.contains_key(&field.id) || data.get_unchecked(&field.id).is_empty() {
                    return false;
                }
            }
        }

        // Validate field types and constraints
        for field in template.fields.iter() {
            if data.contains_key(&field.id) {
                let value = data.get_unchecked(&field.id);
                
                // Validate type-specific constraints
                match field.field_type.as_str() {
                    "email" => {
                        if !Self::is_valid_email(&value) {
                            return false;
                        }
                    }
                    "url" => {
                        if !Self::is_valid_url(&value) {
                            return false;
                        }
                    }
                    "number" => {
                        if value.parse::<i64>().is_err() {
                            return false;
                        }
                    }
                    _ => {}
                }

                // Validate length constraints
                if let Some(min_len) = field.min_length {
                    if value.len() < min_len {
                        return false;
                    }
                }
                if let Some(max_len) = field.max_length {
                    if value.len() > max_len {
                        return false;
                    }
                }

                // Validate pattern
                if let Some(ref pattern) = field.pattern {
                    // In a real implementation, you'd use regex matching
                    // This is a simplified check
                    if !value.contains(pattern.as_str()) {
                        return false;
                    }
                }
            }
        }

        true
    }

    /// Helper function to validate email
    fn is_valid_email(email: &String) -> bool {
        email.contains("@") && email.contains(".")
    }

    /// Helper function to validate URL
    fn is_valid_url(url: &String) -> bool {
        url.starts_with("http://") || url.starts_with("https://")
    }
}

#[cfg(test)]
mod test;
