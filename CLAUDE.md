# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a full-stack Databricks application with two main components:

- **Frontend**: Next.js application (TypeScript/React) in `frontend/`
- **Backend**: FastAPI application (Python) in `backend/`

The application demonstrates AI Functions for document intelligence, including:
- File upload to Unity Catalog volumes
- Document parsing using AI Functions (`ai_parse_document`)
- Table extraction from documents
- Delta table storage and querying
- Excel generation from extracted data

## Architecture

### Frontend (`frontend/`)
- **Framework**: Next.js 15 with TypeScript
- **UI**: TailwindCSS with shadcn/ui components
- **Pages**: App Router structure with pages in `src/app/`
  - Main page: Document upload and processing
  - Document Intelligence: Shows processed results
  - Next Steps: Additional features/demos
- **API Integration**: Dynamic URL resolution for Databricks Apps environment

### Backend (`backend/`)
- **Framework**: FastAPI with automatic Databricks authentication
- **Key Dependencies**: 
  - `databricks-sdk` for Unity Catalog and SQL warehouse operations
  - `fastapi` for REST API
  - `pandas`, `openpyxl`, `mdpd` for Excel generation
- **Configuration**: Environment variables loaded from `app.yaml` and `.env`
- **Storage**: Unity Catalog volumes and Delta tables

## Development Commands

### Frontend Development
```bash
cd frontend
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Build for production
npm run lint       # Run ESLint
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt  # Install dependencies
uvicorn app:app --reload          # Start development server
```

### Deployment
```bash
./deploy.sh [workspace_path] [app_name]
# Builds frontend, packages backend, and deploys to Databricks Apps
```

## Key Configuration

### Environment Variables (app.yaml)
- `DATABRICKS_WAREHOUSE_ID`: SQL warehouse for AI Functions
- `DATABRICKS_VOLUME_PATH`: Unity Catalog volume for file storage
- `DATABRICKS_DELTA_TABLE_PATH`: Delta table for parsed document data
- `NEXT_PUBLIC_API_URL`: Frontend API endpoint (for production)

### API Endpoints
- `/api/upload-to-uc`: Upload files to Unity Catalog volume
- `/api/test-ai-functions`: Test AI Functions availability
- `/api/write-to-delta-table`: Parse documents and write to Delta table
- `/api/query-delta-table`: Query extracted table data
- `/api/generate-excel`: Generate Excel files from table data


## Key Integration Points
- Frontend uses dynamic API URL detection for Databricks Apps environment
- Backend automatically authenticates with Databricks workspace
- Unity Catalog integration for both file storage and metadata
- AI Functions require appropriate warehouse permissions and feature enablement