-- Bank connections, accounts and transactions synced from Finverse.
-- The backend writes with the service role key (which bypasses RLS);
-- signed-in users can only read their own accounts and transactions.

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  login_identity_id text not null unique,
  -- Encrypted by the backend (AES-256-GCM); never readable by the app.
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz not null,
  status text not null default 'LINKING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_connections_user_id_idx on public.bank_connections (user_id);

alter table public.bank_connections enable row level security;
-- No policies: only the service role can touch this table.

create table public.accounts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.bank_connections (id) on delete cascade,
  name text not null,
  type text,
  currency text not null,
  balance numeric,
  masked_number text,
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);

alter table public.accounts enable row level security;

create policy "Users read their own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

create table public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id text not null references public.accounts (id) on delete cascade,
  posted_date date,
  amount numeric not null,
  currency text not null,
  description text not null default '',
  merchant_name text,
  category text,
  -- Set when the user re-categorises; takes precedence over category.
  user_category text,
  is_pending boolean not null default false,
  updated_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, posted_date desc);

alter table public.transactions enable row level security;

create policy "Users read their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);
