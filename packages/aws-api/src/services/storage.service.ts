import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Readable } from 'stream';

/**
 * AWS Storage Service
 * 
 * AWS S3와 DynamoDB를 사용하여 데이터 저장소 서비스를 제공합니다.
 * 
 * 주요 기능:
 * - S3를 통한 파일 및 대용량 데이터 저장
 * - DynamoDB를 통한 메타데이터 및 세션 정보 저장
 * - 자동 업로드/다운로드 및 에러 처리
 */
export class StorageService {
  private s3Client: S3Client;
  private dynamoClient: DynamoDBDocumentClient;
  private bucket: string;
  private table: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const dynamoDBClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    this.dynamoClient = DynamoDBDocumentClient.from(dynamoDBClient);
    this.bucket = process.env.S3_BUCKET || 'code-ai-storage';
    this.table = process.env.DYNAMODB_TABLE || 'code-ai-metadata';
  }

  /**
   * S3에 파일 업로드
   */
  async uploadFile(key: string, body: string | Buffer | Readable, contentType?: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new Error(`Failed to upload file ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * S3에서 파일 다운로드
   */
  async downloadFile(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('File content is empty');
      }

      // Stream을 string으로 변환
      const chunks: Buffer[] = [];
      const stream = response.Body as Readable;
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      });
    } catch (error) {
      throw new Error(`Failed to download file ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * S3에서 파일 삭제
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete file ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * DynamoDB에 메타데이터 저장
   */
  async saveMetadata(id: string, data: any): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.table,
        Item: {
          id,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      await this.dynamoClient.send(command);
    } catch (error) {
      throw new Error(`Failed to save metadata ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * DynamoDB에서 메타데이터 조회
   */
  async getMetadata(id: string): Promise<any | null> {
    try {
      const command = new GetCommand({
        TableName: this.table,
        Key: { id },
      });

      const response = await this.dynamoClient.send(command);
      return response.Item || null;
    } catch (error) {
      throw new Error(`Failed to get metadata ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * DynamoDB에서 메타데이터 검색
   */
  async queryMetadata(indexName: string, keyCondition: any): Promise<any[]> {
    try {
      const command = new QueryCommand({
        TableName: this.table,
        IndexName: indexName,
        KeyConditionExpression: keyCondition.expression,
        ExpressionAttributeValues: keyCondition.values,
        ExpressionAttributeNames: keyCondition.names,
      });

      const response = await this.dynamoClient.send(command);
      return response.Items || [];
    } catch (error) {
      throw new Error(`Failed to query metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * DynamoDB에서 메타데이터 삭제
   */
  async deleteMetadata(id: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: this.table,
        Key: { id },
      });

      await this.dynamoClient.send(command);
    } catch (error) {
      throw new Error(`Failed to delete metadata ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 세션 데이터 저장
   */
  async saveSession(sessionId: string, sessionData: any): Promise<void> {
    const sessionRecord = {
      type: 'session',
      session_id: sessionId,
      data: sessionData,
      ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24시간 TTL
    };

    await this.saveMetadata(`session#${sessionId}`, sessionRecord);
  }

  /**
   * 세션 데이터 조회
   */
  async getSession(sessionId: string): Promise<any | null> {
    const result = await this.getMetadata(`session#${sessionId}`);
    return result?.data || null;
  }

  /**
   * 분석 결과 저장
   */
  async saveAnalysisResult(analysisId: string, result: any): Promise<void> {
    // 큰 결과는 S3에 저장
    if (JSON.stringify(result).length > 50000) {
      const s3Key = `analysis-results/${analysisId}.json`;
      await this.uploadFile(s3Key, JSON.stringify(result, null, 2), 'application/json');
      
      // DynamoDB에는 S3 참조만 저장
      await this.saveMetadata(`analysis#${analysisId}`, {
        type: 'analysis',
        analysis_id: analysisId,
        storage_type: 's3',
        storage_key: s3Key,
        size: JSON.stringify(result).length,
      });
    } else {
      // 작은 결과는 DynamoDB에 직접 저장
      await this.saveMetadata(`analysis#${analysisId}`, {
        type: 'analysis',
        analysis_id: analysisId,
        storage_type: 'dynamodb',
        result,
      });
    }
  }

  /**
   * 분석 결과 조회
   */
  async getAnalysisResult(analysisId: string): Promise<any | null> {
    const metadata = await this.getMetadata(`analysis#${analysisId}`);
    
    if (!metadata) {
      return null;
    }

    if (metadata.storage_type === 's3') {
      const resultJson = await this.downloadFile(metadata.storage_key);
      return JSON.parse(resultJson);
    } else {
      return metadata.result;
    }
  }
}