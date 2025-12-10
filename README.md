# filt — Excel import + table view + reconcile + database

Small demo app with frontend SPA and Express backend with PostgreSQL integration.

## Features
- Reconcile tool: Upload old/messy data and clean template, match records by searching
- FK column auto-fills with template PK
- Save to PostgreSQL database or download as Excel
- Hash-based SPA routing for all pages

## Quick Setup

pm install && npm start then open http://localhost:3000

## Configuration
Edit .env with your PostgreSQL credentials

## Workflow
1. Upload old data (messy product list)
2. Upload template (clean reference with PK)
3. Match each record by searching template
4. Save to database or download Excel
