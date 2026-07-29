/*
# Allow 'announcement' as a valid post_type

Adds 'announcement' to the allowed values in posts_post_type_check,
so Sprout Team broadcast posts can be inserted with post_type = 'announcement'.
*/

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_post_type_check;

ALTER TABLE posts ADD CONSTRAINT posts_post_type_check
CHECK (post_type = ANY (ARRAY['question'::text, 'support'::text, 'meetup'::text, 'listing'::text, 'announcement'::text]));
