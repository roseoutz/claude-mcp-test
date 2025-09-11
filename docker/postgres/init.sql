-- MCP Codebase Analyzer 초기 데이터베이스 설정
-- 이 스크립트는 PostgreSQL 컨테이너 시작 시 자동 실행됩니다

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 스키마 생성
CREATE SCHEMA IF NOT EXISTS mcp;

-- 기본 테이블들
-- 코드베이스 메타데이터 저장
CREATE TABLE IF NOT EXISTS mcp.codebase_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_url VARCHAR(500) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    files_count INTEGER DEFAULT 0,
    features_count INTEGER DEFAULT 0,
    total_lines INTEGER DEFAULT 0,
    languages JSONB,
    statistics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo_url, branch)
);

-- 분석된 기능 저장
CREATE TABLE IF NOT EXISTS mcp.features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codebase_id UUID REFERENCES mcp.codebase_metadata(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    components JSONB,
    data_flow JSONB,
    business_rules JSONB,
    related_files TEXT[],
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 컴포넌트 정보
CREATE TABLE IF NOT EXISTS mcp.components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codebase_id UUID REFERENCES mcp.codebase_metadata(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    path VARCHAR(500) NOT NULL,
    responsibilities TEXT[],
    dependencies JSONB,
    is_critical BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 영향도 분석 결과 저장
CREATE TABLE IF NOT EXISTS mcp.impact_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature VARCHAR(255) NOT NULL,
    change_description TEXT NOT NULL,
    analysis_result JSONB NOT NULL,
    risk_level VARCHAR(20),
    recommendations JSONB,
    estimated_effort VARCHAR(50),
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API 사용 로그
CREATE TABLE IF NOT EXISTS mcp.api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100),
    request_params JSONB,
    response_status VARCHAR(20),
    response_time_ms INTEGER,
    error_message TEXT,
    client_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 캐시 통계
CREATE TABLE IF NOT EXISTS mcp.cache_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    hit_count BIGINT DEFAULT 0,
    miss_count BIGINT DEFAULT 0,
    eviction_count BIGINT DEFAULT 0,
    avg_response_time_ms DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- 인덱스 생성
CREATE INDEX idx_codebase_metadata_repo ON mcp.codebase_metadata(repo_url);
CREATE INDEX idx_codebase_metadata_branch ON mcp.codebase_metadata(branch);
CREATE INDEX idx_features_codebase ON mcp.features(codebase_id);
CREATE INDEX idx_features_name ON mcp.features(name);
CREATE INDEX idx_features_tags ON mcp.features USING GIN (tags);
CREATE INDEX idx_components_codebase ON mcp.components(codebase_id);
CREATE INDEX idx_components_type ON mcp.components(type);
CREATE INDEX idx_impact_analysis_feature ON mcp.impact_analysis(feature);
CREATE INDEX idx_impact_analysis_risk ON mcp.impact_analysis(risk_level);
CREATE INDEX idx_api_usage_logs_method ON mcp.api_usage_logs(method);
CREATE INDEX idx_api_usage_logs_created ON mcp.api_usage_logs(created_at);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 업데이트 트리거 적용
CREATE TRIGGER update_codebase_metadata_updated_at BEFORE UPDATE
    ON mcp.codebase_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_features_updated_at BEFORE UPDATE
    ON mcp.features FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE
    ON mcp.components FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 권한 설정
GRANT ALL PRIVILEGES ON SCHEMA mcp TO mcp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA mcp TO mcp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA mcp TO mcp_user;

-- 초기 데이터 삽입 (선택사항)
INSERT INTO mcp.cache_statistics (date, hit_count, miss_count) 
VALUES (CURRENT_DATE, 0, 0)
ON CONFLICT (date) DO NOTHING;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'MCP 데이터베이스 초기화 완료!';
END $$;