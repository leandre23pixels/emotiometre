create table if not exists public.shared_documents (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists shared_documents_touch_updated_at on public.shared_documents;

create trigger shared_documents_touch_updated_at
before update on public.shared_documents
for each row
execute function public.touch_updated_at();
