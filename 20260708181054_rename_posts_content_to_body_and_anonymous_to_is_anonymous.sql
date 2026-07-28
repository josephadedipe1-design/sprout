-- Rename posts.content → posts.body
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='content') THEN
    ALTER TABLE posts RENAME COLUMN content TO body;
  END IF;
END $$;

-- Rename posts.anonymous → posts.is_anonymous
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='anonymous') THEN
    ALTER TABLE posts RENAME COLUMN anonymous TO is_anonymous;
  END IF;
END $$;
