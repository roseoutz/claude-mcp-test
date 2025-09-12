import { Router } from 'express';
import { AnalysisRequest, ApiResponse } from '@code-ai/shared';
import { AnalysisService } from '../services/analysis.service';
import { StorageService } from '../services/storage.service';

export const router = Router();

const analysisService = new AnalysisService();
const storageService = new StorageService();

router.post('/learn', async (req, res) => {
  try {
    const { repository, branch = 'main', patterns = ['**/*.{js,ts,jsx,tsx}'] } = req.body;
    const sessionId = `http_session_${Date.now()}`;
    
    // AnalysisService를 사용하여 학습 시작
    const result = await analysisService.startLearning(sessionId, repository, branch, patterns);
    
    const response: ApiResponse = {
      success: true,
      data: {
        session_id: sessionId,
        ...result,
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
    const { sessionId, baseBranch, targetBranch, includeImpact = false } = req.body;
    
    // AnalysisService를 사용하여 diff 분석
    const diffResults = await analysisService.analyzeDiff(sessionId, baseBranch, targetBranch, includeImpact);
    
    const response: ApiResponse = {
      success: true,
      data: {
        session_id: sessionId,
        results: diffResults,
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

// 새로운 엔드포인트들 추가
router.post('/search', async (req, res) => {
  try {
    const { sessionId, query, semantic = false } = req.body;
    
    const results = await analysisService.searchCode(sessionId, query, semantic);
    
    res.json({
      success: true,
      data: {
        query,
        semantic,
        results,
        total_results: results.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { sessionId, analysisType } = req.body;
    
    const analysisResult = await analysisService.analyzeCode(sessionId, analysisType);
    
    res.json({
      success: true,
      data: analysisResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionData = await storageService.getSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }
    
    res.json({
      success: true,
      data: sessionData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});