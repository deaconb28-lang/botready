-- Which host actually answered.
--
-- `scans.url` is the exact URL requested and stays that way. A great many
-- small-business sites answer on www and not on the bare domain (or the
-- reverse), and the scanner now retries the sibling hostname when the first
-- one fails at the transport level. The reader needs to know which one we
-- read: a scan of www.example.com is not a scan of example.com, and a bare
-- domain that will not serve TLS is losing more than agent traffic.
--
-- Null means the requested host answered, which is the overwhelming majority
-- and every row written before this column existed. A value here always means
-- "we asked for something else and this is what we read".
alter table scans add column if not exists effective_url text;

comment on column scans.effective_url is
  'The origin that answered, when it differs from url. Null when url answered.';

notify pgrst, 'reload schema';
