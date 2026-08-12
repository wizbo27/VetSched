import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Calendar Recommendation Endpoint
  app.post('/api/optimize-schedule', async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
      }

      const { shifts, timeOffRequests, settings } = req.body;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        As an AI schedule optimizer for a veterinary clinic, analyze the following schedule data to recommend coverage optimizations and minimize gaps.
        Identify any conflicts (like a doctor scheduled during a time off).
        Suggest a few bullet points on how to improve the schedule.
        
        Clinic Operating Hours:
        Open Time: ${settings?.openTime || '08:00'}
        Close Time: ${settings?.closeTime || '18:00'}

        Shifts:
        ${JSON.stringify(shifts, null, 2)}
        
        Time Off Requests:
        ${JSON.stringify(timeOffRequests, null, 2)}
      `;

      const interaction = await ai.interactions.create({
        model: 'gemini-3.6-flash',
        input: prompt
      });

      res.json({ recommendation: interaction.output_text });
    } catch (error: any) {
      console.error('Error generating AI recommendation:', error);
      res.status(500).json({ error: error.message });
    }
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
