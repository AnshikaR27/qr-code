-- Add table merging columns
-- merged_with: array of table IDs this table is merged with
-- merge_group_id: shared UUID for all tables in a merge group

ALTER TABLE tables ADD COLUMN merged_with uuid[] DEFAULT NULL;
ALTER TABLE tables ADD COLUMN merge_group_id uuid DEFAULT NULL;

-- Index for efficient merge group lookups
CREATE INDEX idx_tables_merge_group ON tables (merge_group_id) WHERE merge_group_id IS NOT NULL;
