-- Enable realtime on the tables table so the floor plan can pick up
-- merge_group_id changes made from the Kitchen Dashboard Orders tab.
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
