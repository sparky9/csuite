# Content Writer Data Directory

This directory stores persistent data for the Content Writer MCP module.

## Files

### brand-voices.json
Stores brand voice profiles for different clients. Each profile includes:
- Voice name
- Tone settings
- Vocabulary preferences
- Words to avoid
- Sample text

Created automatically when `save_brand_voice` tool is first used.

### content-templates.json
Stores reusable content templates with variables. Templates are pre-populated with common use cases for:
- Emails (product launches, cold outreach, event invitations)
- Blogs (how-to guides, case studies)
- Social media (announcements, captions, threads)
- Newsletters (weekly, monthly updates)

Created automatically when `list_content_templates` tool is first used.

## Data Format

All data is stored in JSON format and follows a multi-tenant structure with userId fields for isolation.

## Privacy

This directory contains user-specific data and is excluded from version control via .gitignore.
