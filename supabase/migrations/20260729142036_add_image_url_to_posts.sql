/*
# Add image_url to posts

Adds a nullable `image_url` column to the `posts` table, used to store
an optional image for Sprout Team announcement posts.
*/

ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url text;
