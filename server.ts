import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const db = new sqlite3.Database('ecoai.db');

// Initialize Database
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      model_name TEXT,
      hardware TEXT,
      region TEXT,
      type TEXT,
      status TEXT,
      start_time DATETIME,
      end_time DATETIME,
      total_energy_kwh REAL DEFAULT 0,
      total_carbon_kg REAL DEFAULT 0,
      total_water_l REAL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      timestamp DATETIME,
      gpu_power_w REAL,
      cpu_power_w REAL,
      FOREIGN KEY(run_id) REFERENCES runs(id)
    )
  `);

  // Seed Data for Showcase
  db.get("SELECT COUNT(*) as count FROM runs", (err, row: any) => {
    if (!err && row.count === 0) {
      const exampleRuns = [
        {
          id: 'run_example_1',
          model_name: 'Llama-3-70B (Fine-tuning)',
          hardware: 'NVIDIA H100',
          region: 'US West (Oregon)',
          type: 'Training',
          status: 'finished',
          start_time: new Date(Date.now() - 86400000 * 2).toISOString(),
          end_time: new Date(Date.now() - 86400000 * 2 + 3600000 * 12).toISOString(),
          total_energy_kwh: 45.2,
          total_carbon_kg: 3.7,
          total_water_l: 54.2
        },
        {
          id: 'run_example_2',
          model_name: 'Stable Diffusion XL',
          hardware: 'NVIDIA A100',
          region: 'Europe (Sweden)',
          type: 'Inference',
          status: 'finished',
          start_time: new Date(Date.now() - 86400000).toISOString(),
          end_time: new Date(Date.now() - 86400000 + 3600000 * 2).toISOString(),
          total_energy_kwh: 12.5,
          total_carbon_kg: 0.15,
          total_water_l: 13.7
        },
        {
          id: 'run_example_3',
          model_name: 'GPT-NeoX-20B',
          hardware: 'Google TPU v4',
          region: 'India (Average)',
          type: 'Training',
          status: 'finished',
          start_time: new Date(Date.now() - 3600000 * 5).toISOString(),
          end_time: new Date(Date.now() - 3600000 * 1).toISOString(),
          total_energy_kwh: 85.0,
          total_carbon_kg: 63.75,
          total_water_l: 297.5
        }
      ];

      exampleRuns.forEach(run => {
        db.run(
          'INSERT INTO runs (id, model_name, hardware, region, type, status, start_time, end_time, total_energy_kwh, total_carbon_kg, total_water_l) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [run.id, run.model_name, run.hardware, run.region, run.type, run.status, run.start_time, run.end_time, run.total_energy_kwh, run.total_carbon_kg, run.total_water_l]
        );

        // Add some dummy metrics for the charts
        for (let i = 0; i < 10; i++) {
          const timestamp = new Date(new Date(run.start_time).getTime() + i * 600000).toISOString();
          db.run(
            'INSERT INTO metrics (run_id, timestamp, gpu_power_w, cpu_power_w) VALUES (?, ?, ?, ?)',
            [run.id, timestamp, 200 + Math.random() * 100, 50 + Math.random() * 20]
          );
        }
      });
    }
  });
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  
  // Create a new run
  app.post('/api/runs', (req, res) => {
    const { id, modelName, hardware, region, type } = req.body;
    const startTime = new Date().toISOString();
    
    db.run(
      'INSERT INTO runs (id, model_name, hardware, region, type, status, start_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, modelName, hardware, region, type, 'running', startTime],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, status: 'running' });
      }
    );
  });

  // Add metrics for a run
  app.post('/api/metrics', (req, res) => {
    const { runId, gpuPower, cpuPower } = req.body;
    const timestamp = new Date().toISOString();

    db.run(
      'INSERT INTO metrics (run_id, timestamp, gpu_power_w, cpu_power_w) VALUES (?, ?, ?, ?)',
      [runId, timestamp, gpuPower, cpuPower],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  });

  // Finish a run and calculate totals (Estimation Engine)
  app.post('/api/runs/:id/finish', (req, res) => {
    const { id } = req.params;
    const { carbonIntensity, pue, waterIntensity } = req.body;
    const endTime = new Date().toISOString();

    // Get all metrics to calculate energy
    db.all('SELECT * FROM metrics WHERE run_id = ? ORDER BY timestamp ASC', [id], (err, rows: any[]) => {
      if (err) return res.status(500).json({ error: err.message });

      let totalEnergyKWh = 0;
      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const t1 = new Date(rows[i - 1].timestamp).getTime();
          const t2 = new Date(rows[i].timestamp).getTime();
          const durationSeconds = (t2 - t1) / 1000;
          
          const avgPowerW = (rows[i].gpu_power_w + rows[i].cpu_power_w + rows[i - 1].gpu_power_w + rows[i - 1].cpu_power_w) / 2;
          const energyKWh = (avgPowerW * durationSeconds) / (3600 * 1000);
          totalEnergyKWh += energyKWh;
        }
      }

      // Apply PUE and calculate carbon
      const totalEnergyWithPue = totalEnergyKWh * pue;
      const totalCarbonKg = totalEnergyWithPue * carbonIntensity;
      const totalWaterL = totalEnergyWithPue * waterIntensity;

      db.run(
        'UPDATE runs SET status = ?, end_time = ?, total_energy_kwh = ?, total_carbon_kg = ?, total_water_l = ? WHERE id = ?',
        ['finished', endTime, totalEnergyWithPue, totalCarbonKg, totalWaterL, id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id, totalEnergyKWh: totalEnergyWithPue, totalCarbonKg, totalWaterL });
        }
      );
    });
  });

  // Get all runs
  app.get('/api/runs', (req, res) => {
    db.all('SELECT * FROM runs ORDER BY start_time DESC', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Get run details
  app.get('/api/runs/:id', (req, res) => {
    db.get('SELECT * FROM runs WHERE id = ?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });

  // Get run metrics
  app.get('/api/runs/:id/metrics', (req, res) => {
    db.all('SELECT * FROM metrics WHERE run_id = ? ORDER BY timestamp ASC', [req.params.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ECOAI] Server running on http://localhost:${PORT}`);
    console.log(`[ECOAI] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

console.log('[ECOAI] Starting server...');
startServer().catch(err => {
  console.error('[ECOAI] Failed to start server:', err);
});
