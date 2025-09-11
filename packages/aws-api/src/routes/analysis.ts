import { Router } from 'express';
import { AnalysisRequest, ApiResponse } from '@code-ai/shared';
import { OpenAI } from 'openai';

export const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/learn', async (req, res) => {
  try {
    const analysisRequest: AnalysisRequest = req.body;
    
    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Codebase learning initiated',
        repository: analysisRequest.repository,
        timestamp: new Date().toISOString(),
      },
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/diff', async (req, res) => {
  try {
    const analysisRequest: AnalysisRequest = req.body;
    
    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Diff analysis initiated',
        repository: analysisRequest.repository,
        timestamp: new Date().toISOString(),
      },
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});