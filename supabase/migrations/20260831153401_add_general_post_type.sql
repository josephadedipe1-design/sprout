/*
# Allow 'general' as a valid post_type

Adds 'general' to the allowed values in posts_post_type_check, for posts that
don't fit the existing categories (e.g. introductions, general chat).
*/

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_post_type_check;

ALTER TABLE posts ADD CONSTRAINT posts_post_type_check
CHECK (post_type = ANY (ARRAY['question'::text, 'support'::text, 'meetup'::text, 'listing'::text, 'announcement'::text, 'general'::text]));
