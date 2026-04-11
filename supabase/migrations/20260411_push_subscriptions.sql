-- Web Push notification subscriptions for customer order updates
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_order_id on push_subscriptions(order_id);
create unique index idx_push_subscriptions_order_endpoint on push_subscriptions(order_id, endpoint);

-- Allow anyone to insert (customers are anonymous)
alter table push_subscriptions enable row level security;

create policy "Anyone can subscribe to push for an order"
  on push_subscriptions for insert
  with check (true);

-- Only service role (API routes) should read/delete
create policy "Service role can manage push subscriptions"
  on push_subscriptions for all
  using (auth.role() = 'service_role');
