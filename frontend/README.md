# EPL Predictor Frontend

Next.js frontend for the EPL Match Predictor, designed to be deployed on Vercel.

## Features

- View upcoming Premier League fixtures
- See AI-powered predictions with probabilities
- Clean, modern UI
- Responsive design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

## Environment Variables

Create a `.env.local` file (optional):
```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## API Endpoints

The frontend uses the following API routes:

- `GET /api/fixtures` - Fetch upcoming fixtures
- `POST /api/predict` - Get prediction for a match
- `GET /api/predictions` - Batch predictions for all fixtures
- `GET /api/team-form/[team]` - Get team form statistics

## Notes

- The API routes currently use mock data or call Python scripts via subprocess
- For production, consider:
  - Setting up a separate Python API server (FastAPI/Flask)
  - Using Vercel serverless functions with Python runtime
  - Storing model files in cloud storage (S3, Cloudinary)

