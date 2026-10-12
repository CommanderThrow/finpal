-- The category a transaction counts under: the user's choice, else Finverse's.
alter table public.transactions
  add column effective_category text generated always as (coalesce(user_category, category)) stored;

create index transactions_user_category_idx on public.transactions (user_id, effective_category);

-- "Always file this merchant under this category", applied on every sync.
create table public.category_rules (
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_name text not null,
  category text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, merchant_name)
);

alter table public.category_rules enable row level security;

create policy "Users read their own category rules"
  on public.category_rules for select
  using (auth.uid() = user_id);
