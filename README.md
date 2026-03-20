# EcoAI Tracker 🌿

EcoAI Tracker is a comprehensive tool designed to estimate, track, and optimize the environmental footprint of AI workloads. It provides real-time monitoring of energy consumption, carbon emissions, and water usage, helping developers and researchers build more sustainable AI.

## Features

- **Footprint Calculator**: Estimate the environmental impact of training and inference workloads based on hardware, region, and model parameters.
- **Real-time Tracking**: Monitor live GPU and CPU power consumption during AI runs using the EcoAI SDK.
- **Sustainability Dashboard**: Visualize historical data, compare runs, and analyze trends in your AI infrastructure's footprint.
- **AI-Powered Insights**: Get personalized recommendations to reduce your carbon footprint, such as region switching, quantization, or scheduling.
- **Validation Reports**: Generate detailed environmental audit reports using Gemini AI to verify and optimize your results.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts, Lucide React, Motion.
- **Backend**: Node.js, Express, SQLite.
- **AI Integration**: Google Gemini API (via `@google/genai`).

## Getting Started

### Prerequisites

- Node.js installed.
- A Google Gemini API Key.

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   Create a `.env` file and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

### Running the App

Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## Environmental Metrics

- **Operational Carbon**: Emissions from the electricity used to run the hardware.
- **Embodied Carbon**: Emissions from the manufacturing and disposal of the hardware, amortized over its lifespan.
- **Water Intensity**: Water used for cooling and electricity generation.
- **PUE (Power Usage Effectiveness)**: A measure of data center efficiency.

## License

MIT
