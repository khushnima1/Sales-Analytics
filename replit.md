# Sales Analytics Dashboard

## Overview

This is a full-stack web application built for sales data analysis and visualization, specifically designed for the Indian EV 2-wheeler market intelligence. The application provides CEOs and business leaders with tools to visualize competitor sales data, identify emerging markets, and make data-driven decisions through interactive maps, charts, and analytics.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API endpoints
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (configured via Neon serverless)
- **File Processing**: Multer for file uploads, XLSX for Excel file parsing
- **Development Server**: Custom Vite middleware integration for HMR

### Build and Development
- **Development**: tsx for TypeScript execution, Vite dev server with HMR
- **Production**: esbuild for server bundling, Vite build for client assets
- **Deployment**: Configured for Replit autoscale deployment

## Key Components

### Data Management
- **Database Schema**: Sales data table with fields for state, city, coordinates, and yearly sales figures (2022-2025)
- **Data Storage**: Abstract storage interface with in-memory implementation (extensible to PostgreSQL)
- **File Upload**: Excel file processing with validation and bulk data import
- **Data Validation**: Zod schemas for type-safe data handling

### Visualization Components
- **Interactive Map**: Google Maps integration with multiple view modes (heatmap, markers, clusters)
- **Data Table**: Paginated table with search, filtering, and growth rate calculations
- **Metrics Overview**: Executive dashboard with KPI cards showing totals, growth rates, and market insights
- **Year Filter**: Multi-select year filtering for temporal analysis

### User Interface
- **Responsive Design**: Mobile-first approach with Tailwind CSS breakpoints
- **Accessibility**: ARIA labels, keyboard navigation, and semantic HTML
- **Toast Notifications**: User feedback for actions and errors
- **Loading States**: Skeleton loaders and progress indicators

## Data Flow

1. **File Upload**: Users upload Excel files containing sales data
2. **Data Processing**: Server validates and parses Excel files using XLSX
3. **Data Storage**: Validated data is stored in PostgreSQL database via Drizzle ORM
4. **API Endpoints**: REST endpoints serve data to frontend components
5. **Client Rendering**: React components fetch data using TanStack Query
6. **Visualization**: Data is rendered in maps, tables, and charts with interactive filtering

## External Dependencies

### Core Dependencies
- **Database**: @neondatabase/serverless for PostgreSQL connection
- **UI Components**: @radix-ui/* for accessible component primitives
- **Maps**: Google Maps JavaScript API for geographic visualization
- **File Processing**: multer for uploads, xlsx for Excel parsing
- **Validation**: zod for schema validation, drizzle-zod for ORM integration

### Development Dependencies
- **Build Tools**: vite, esbuild, tsx for development and build processes
- **Replit Integration**: @replit/vite-plugin-cartographer for enhanced development experience

## Deployment Strategy

### Environment Configuration
- **Database**: PostgreSQL connection via DATABASE_URL environment variable
- **Maps**: Google Maps API key via VITE_GOOGLE_MAPS_API_KEY
- **Build Process**: Vite builds client assets, esbuild bundles server code

### Production Deployment
- **Platform**: Replit autoscale deployment
- **Build Command**: `npm run build` - builds both client and server
- **Start Command**: `npm run start` - runs production server
- **Port Configuration**: Server runs on port 5000, mapped to external port 80

### Development Workflow
- **Local Development**: `npm run dev` starts both client and server with HMR
- **Database Migrations**: `npm run db:push` applies schema changes
- **Type Checking**: `npm run check` validates TypeScript across the project

## Changelog

```
Changelog:
- June 27, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```