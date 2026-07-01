-- 입점 신청 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣어 실행하세요.

CREATE TABLE IF NOT EXISTS partner_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name text NOT NULL,
  owner_name text NOT NULL,
  biz_number text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  category text[],
  message text,
  privacy_agreed boolean DEFAULT false,
  terms_agreed boolean DEFAULT false,
  agreed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 기존 테이블에 약관 동의 기록 컬럼 추가 (이미 있으면 무시)
ALTER TABLE partner_applications
  ADD COLUMN IF NOT EXISTS privacy_agreed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_agreed   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreed_at      timestamptz;

-- (권장) RLS 활성화 + 익명 insert 만 허용
-- 이 블록을 실행하지 않으면 anon 키로 테이블 전체 조회/수정이 가능해집니다.
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can insert applications" ON partner_applications;
CREATE POLICY "anon can insert applications"
  ON partner_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);
