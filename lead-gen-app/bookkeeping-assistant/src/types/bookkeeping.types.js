/**
 * TypeScript Types for Bookkeeping Assistant MCP
 */
// Financial categories
export const EXPENSE_CATEGORIES = {
    office_supplies: 'Office Supplies',
    software: 'Software & Tools',
    marketing: 'Marketing & Advertising',
    travel: 'Travel & Transportation',
    meals: 'Meals & Entertainment',
    utilities: 'Utilities',
    professional_services: 'Professional Services',
    other: 'Other Expenses',
};
export const INCOME_CATEGORIES = {
    product_sales: 'Product Sales',
    service_revenue: 'Service Revenue',
    consulting: 'Consulting',
    commissions: 'Commissions',
    other: 'Other Income',
};
// Tax brackets (simplified for US)
export const TAX_BRACKETS = {
    2023: [
        { min: 0, max: 11000, rate: 0.10 },
        { min: 11000, max: 44725, rate: 0.12 },
        { min: 44725, max: 95375, rate: 0.22 },
        { min: 95375, max: 182100, rate: 0.24 },
        { min: 182100, max: 231250, rate: 0.32 },
        { min: 231250, max: 578125, rate: 0.35 },
        { min: 578125, max: Infinity, rate: 0.37 },
    ],
};
