/**
 * Core prospect data types for ProspectFinder MCP
 */
export interface Company {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    country: string;
    industry: string | null;
    business_category: string | null;
    employee_count_estimate: number | null;
    revenue_estimate: string | null;
    google_maps_url: string | null;
    linkedin_url: string | null;
    rating: number | null;
    review_count: number | null;
    data_quality_score: number;
    data_completeness_pct: number;
    embedding: number[] | null;
    scraped_at: Date;
    last_enriched_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export interface DecisionMaker {
    id: string;
    company_id: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    found_via: 'linkedin' | 'website' | 'email_pattern' | 'manual';
    confidence_score: number;
    created_at: Date;
    updated_at: Date;
}
export interface ScrapingJob {
    id: string;
    job_type: 'yellow_pages' | 'google_maps' | 'linkedin_company' | 'linkedin_people' | 'email_finder';
    parameters: Record<string, any>;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'rate_limited';
    progress_pct: number;
    results_count: number;
    companies_found: number;
    people_found: number;
    error_message: string | null;
    retry_count: number;
    max_retries: number;
    started_at: Date | null;
    completed_at: Date | null;
    duration_seconds: number | null;
    proxy_used: string | null;
    rate_limit_hit: boolean;
    created_at: Date;
}
export interface DuplicateCandidate {
    id: string;
    company_id_1: string;
    company_id_2: string;
    similarity_score: number;
    name_similarity: number;
    location_match: boolean;
    is_duplicate: boolean | null;
    merged_into_id: string | null;
    reviewed_at: Date | null;
    created_at: Date;
}
export interface SearchCompaniesParams {
    location: string;
    industry?: string;
    radius_miles?: number;
    min_rating?: number;
    max_results?: number;
    include_emails?: boolean;
    include_decision_makers?: boolean;
}
export interface FindDecisionMakersParams {
    company_id: string;
    job_titles?: string[];
    max_results?: number;
}
export interface EnrichCompanyParams {
    company_id: string;
    sources?: ('linkedin' | 'website')[];
    fields?: ('employee_count' | 'revenue' | 'industry')[];
}
export interface ExportProspectsParams {
    company_ids?: string[];
    filters?: {
        min_quality_score?: number;
        industries?: string[];
        states?: string[];
        has_email?: boolean;
        has_phone?: boolean;
        has_decision_makers?: boolean;
    };
    format: 'csv' | 'json' | 'google_sheets';
    include_decision_makers?: boolean;
}
export interface GetScrapingStatsParams {
    time_range?: 'today' | 'week' | 'month' | 'all';
}
export interface GoogleMapsResult {
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    website: string | null;
    category: string | null;
    rating: number | null;
    review_count: number | null;
    google_maps_url: string;
}
export interface LinkedInCompanyResult {
    name: string;
    linkedin_url: string;
    industry: string | null;
    employee_count: number | null;
    website: string | null;
    description: string | null;
}
export interface LinkedInPersonResult {
    full_name: string;
    title: string | null;
    linkedin_url: string;
    company_name: string | null;
}
export interface EmailFinderResult {
    email: string;
    confidence: 'high' | 'medium' | 'low';
    source: 'website' | 'pattern' | 'api';
    verified: boolean;
}
export interface YellowPagesResult {
    name: string;
    phone: string | null;
    additional_phones: string[];
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    website: string | null;
    category: string | null;
    years_in_business: number | null;
    services: string[];
    bbb_rating: string | null;
    yellow_pages_url: string;
}
export interface QualityScoreFactors {
    has_phone: boolean;
    has_email: boolean;
    has_website: boolean;
    has_address: boolean;
    has_rating: boolean;
    has_linkedin: boolean;
    has_employee_count: boolean;
    has_decision_makers: boolean;
    decision_maker_count: number;
}
export interface QualityScore {
    overall_score: number;
    completeness_pct: number;
    factors: QualityScoreFactors;
    recommendation: 'excellent' | 'good' | 'fair' | 'poor';
}
//# sourceMappingURL=prospect.types.d.ts.map