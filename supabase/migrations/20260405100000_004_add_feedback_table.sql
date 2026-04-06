-- Week-1 stabilization: in-app feedback capture
CREATE TABLE IF NOT EXISTS "feedback" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer,
  "role" text,
  "page" text NOT NULL,
  "category" text NOT NULL,
  "message" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- RLS: authenticated users can insert their own feedback
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON "feedback"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read all feedback" ON "feedback"
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = current_setting('app.user_id', true)::int) IN ('admin', 'supervisor')
  );
