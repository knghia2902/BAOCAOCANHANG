# Pitfalls Research

**Project:** Góc Nhỏ Tiện Ích Của Ánh
**Feature:** Theo dõi Cân Kho và Container
**Researched:** 2026-07-25

## Key Pitfalls and Mitigations

### 1. Duplicate Records
- **Issue:** Users might upload the same Excel file multiple times, creating thousands of duplicate records.
- **Mitigation:** Enforce a composite unique constraint `(ticket_no, type)` in the database schema. When importing, use Supabase's `.upsert()` with `onConflict: 'ticket_no,type'` or manually check for duplicates in code.

### 2. Large File Performance
- **Issue:** Large files with 10,000+ rows can lock up the browser thread during Excel parsing or crash memory limits.
- **Mitigation:**
  - Limit the upload file size (e.g. max 15MB).
  - Use chunking when inserting records to Supabase (e.g. upserting in batches of 100 or 200 records) to avoid API request timeouts.
  - Implement pagination for UI tables.

### 3. Date Formatting Inconsistencies
- **Issue:** Date columns in Excel can be serial numbers, strings, or JS Date objects, leading to import errors or incorrect dates.
- **Mitigation:** Use a robust date parser that checks the type of the Excel cell value and safely formats it to an ISO/UTC timestamp before sending to Supabase.

---
*Research completed: 2026-07-25*
