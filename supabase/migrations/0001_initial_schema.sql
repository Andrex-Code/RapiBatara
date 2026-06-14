create extension if not exists "pgcrypto";

create type public.app_role as enum ('resident', 'owner', 'courier');
create type public.payment_method as enum ('transfer', 'cash');
create type public.order_status as enum ('pending_review', 'approved', 'on_route', 'delivered', 'rejected', 'cancelled');
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'refunded');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'RapiBatará',
  logo_url text,
  primary_color text not null default '#10B981',
  announcement_active boolean not null default true,
  delivery_zones jsonb not null default '[]'::jsonb,
  opening_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  role public.app_role not null default 'resident',
  full_name text not null,
  phone text,
  tower text,
  apartment text,
  nearby_complex text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_at integer not null default 5 check (low_stock_at >= 0),
  image_url text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  courier_id uuid references public.profiles(id) on delete set null,
  status public.order_status not null default 'pending_review',
  payment_method public.payment_method not null,
  destination text not null,
  customer_note text,
  reject_reason text,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  proof_path text,
  cash_received_cents integer check (cash_received_cents >= 0),
  cash_change_cents integer check (cash_change_cents >= 0),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  courier_id uuid references public.profiles(id) on delete set null,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  delivery_note text,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  body text,
  image_url text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  store_id uuid references public.stores(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_store_role_idx on public.profiles (store_id, role);
create index categories_store_order_idx on public.categories (store_id, display_order);
create index products_store_category_idx on public.products (store_id, category_id) where is_active = true;
create index products_low_stock_idx on public.products (store_id, stock) where is_active = true;
create index orders_store_status_idx on public.orders (store_id, status, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index payments_order_idx on public.payments (order_id);
create index audit_logs_store_created_idx on public.audit_logs (store_id, created_at desc);

create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.current_store_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select store_id from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger products_touch_updated_at
before update on public.products
for each row execute function public.touch_updated_at();

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.deliveries enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;

create policy "active users can read their store"
on public.stores for select
using (id = public.current_store_id());

create policy "owners can update their store"
on public.stores for update
using (public.current_user_role() = 'owner' and id = public.current_store_id())
with check (public.current_user_role() = 'owner' and id = public.current_store_id());

create policy "users can read own profile"
on public.profiles for select
using (id = auth.uid() or (store_id = public.current_store_id() and public.current_user_role() in ('owner', 'courier')));

create policy "users can update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "catalog is readable by store users"
on public.categories for select
using (store_id = public.current_store_id());

create policy "owners manage categories"
on public.categories for all
using (public.current_user_role() = 'owner' and store_id = public.current_store_id())
with check (public.current_user_role() = 'owner' and store_id = public.current_store_id());

create policy "products are readable by store users"
on public.products for select
using (store_id = public.current_store_id() and is_active = true);

create policy "owners manage products"
on public.products for all
using (public.current_user_role() = 'owner' and store_id = public.current_store_id())
with check (public.current_user_role() = 'owner' and store_id = public.current_store_id());

create policy "residents read own orders"
on public.orders for select
using (
  customer_id = auth.uid()
  or (store_id = public.current_store_id() and public.current_user_role() in ('owner', 'courier'))
);

create policy "residents create own orders"
on public.orders for insert
with check (customer_id = auth.uid() and store_id = public.current_store_id());

create policy "staff update operational orders"
on public.orders for update
using (store_id = public.current_store_id() and public.current_user_role() in ('owner', 'courier'))
with check (store_id = public.current_store_id() and public.current_user_role() in ('owner', 'courier'));

create policy "order items follow visible orders"
on public.order_items for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
    and (
      orders.customer_id = auth.uid()
      or (orders.store_id = public.current_store_id() and public.current_user_role() in ('owner', 'courier'))
    )
  )
);

create policy "residents create items for own orders"
on public.order_items for insert
with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
    and orders.customer_id = auth.uid()
  )
);

create policy "payments follow visible orders"
on public.payments for select
using (
  exists (
    select 1 from public.orders
    where orders.id = payments.order_id
    and (
      orders.customer_id = auth.uid()
      or (orders.store_id = public.current_store_id() and public.current_user_role() in ('owner', 'courier'))
    )
  )
);

create policy "residents create payments for own orders"
on public.payments for insert
with check (
  exists (
    select 1 from public.orders
    where orders.id = payments.order_id
    and orders.customer_id = auth.uid()
  )
);

create policy "owners review payments"
on public.payments for update
using (public.current_user_role() = 'owner')
with check (public.current_user_role() = 'owner');

create policy "deliveries visible to staff"
on public.deliveries for select
using (public.current_user_role() in ('owner', 'courier'));

create policy "couriers update own deliveries"
on public.deliveries for update
using (courier_id = auth.uid() or public.current_user_role() = 'owner')
with check (courier_id = auth.uid() or public.current_user_role() = 'owner');

create policy "announcements readable by store users"
on public.announcements for select
using (store_id = public.current_store_id());

create policy "owners manage announcements"
on public.announcements for all
using (public.current_user_role() = 'owner' and store_id = public.current_store_id())
with check (public.current_user_role() = 'owner' and store_id = public.current_store_id());

create policy "owners read audit logs"
on public.audit_logs for select
using (public.current_user_role() = 'owner' and store_id = public.current_store_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

create policy "users upload own payment proofs"
on storage.objects for insert
with check (
  bucket_id = 'payment-proofs'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users read relevant payment proofs"
on storage.objects for select
using (
  bucket_id = 'payment-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_user_role() in ('owner', 'courier')
  )
);
