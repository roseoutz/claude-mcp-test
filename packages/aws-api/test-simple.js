#!/usr/bin/env node

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';

async function testAnalyze() {
  console.log('📚 Testing /api/v1/analyze endpoint...');

  try {
    const response = await fetch(`${API_URL}/api/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repositoryPath: '/tmp/letsgo',
        patterns: ['**/*.java'],
        excludePaths: ['target', 'build'],
        forceReindex: true
      })
    });

    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAnalyze();