-- =============================================================
--  SERVIGO 2.0 - PostgreSQL schema
--  Ported from the original SQL Server script (SERVIGO_Database.sql)
--
--  Changes vs the SQL Server original:
--    * IDENTITY(1,1)      -> GENERATED ALWAYS AS IDENTITY
--    * NVARCHAR/NCHAR     -> text with CHECK constraints
--    * BIT                -> boolean
--    * GETDATE()          -> now()
--    * Stored procedures  -> plpgsql functions (same business rules)
--    * Triggers           -> plpgsql trigger functions (same audit behaviour)
--    * Added: password_hash is never seeded with a literal. The first
--      admin is claimed at runtime through /admin/setup.
-- =============================================================

-- ---------- REFERENCE TABLES ---------------------------------

create table if not exists roles (
    role_id   int generated always as identity primary key,
    role_name text not null unique
);

create table if not exists booking_statuses (
    status_id   int generated always as identity primary key,
    status_name text not null unique
);

create table if not exists service_categories (
    category_id   int generated always as identity primary key,
    category_name text not null unique
);

-- ---------- CORE TABLES --------------------------------------

create table if not exists users (
    user_id       text primary key,                       -- SRV-00001
    full_name     text not null check (char_length(full_name) between 3 and 100),
    email         text not null unique check (email = lower(email)),
    phone         text not null unique check (phone ~ '^0[0-9]{10}$'),
    cnic          text not null unique check (cnic ~ '^[0-9]{13}$'),
    password_hash text not null,
    role_id       int  not null references roles(role_id),
    is_active     boolean not null default true,
    created_at    timestamptz not null default now()
);

create table if not exists service_providers (
    provider_id    int generated always as identity primary key,
    user_id        text not null unique references users(user_id) on delete cascade,
    category_id    int  not null references service_categories(category_id),
    description    text,
    is_approved    boolean not null default false,
    average_rating numeric(3,2) not null default 0.00,
    created_at     timestamptz not null default now()
);

create table if not exists services (
    service_id       int generated always as identity primary key,
    provider_id      int  not null references service_providers(provider_id) on delete cascade,
    service_name     text not null,
    description      text,
    price            numeric(10,2) not null check (price >= 0),
    duration_minutes int  not null check (duration_minutes > 0),
    is_active        boolean not null default true
);

create table if not exists time_slots (
    slot_id      int generated always as identity primary key,
    provider_id  int  not null references service_providers(provider_id) on delete cascade,
    slot_date    date not null,
    start_time   time(0) not null,
    end_time     time(0) not null,
    is_available boolean not null default true,
    constraint uq_provider_date_start unique (provider_id, slot_date, start_time),
    constraint ck_slot_time_order check (end_time > start_time)
);

create table if not exists bookings (
    booking_id  int generated always as identity primary key,
    customer_id text not null references users(user_id) on delete cascade,
    slot_id     int  not null references time_slots(slot_id),
    service_id  int  not null references services(service_id),
    status_id   int  not null references booking_statuses(status_id),
    notes       text,
    booked_at   timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table if not exists notifications (
    notification_id int generated always as identity primary key,
    user_id         text not null references users(user_id) on delete cascade,
    message         text not null,
    is_read         boolean not null default false,
    created_at      timestamptz not null default now()
);

create table if not exists ratings (
    rating_id   int generated always as identity primary key,
    booking_id  int  not null unique references bookings(booking_id) on delete cascade,
    provider_id int  not null references service_providers(provider_id) on delete cascade,
    customer_id text references users(user_id) on delete set null,
    stars       smallint not null check (stars between 1 and 5),
    comment     text,
    created_at  timestamptz not null default now()
);

create table if not exists feedback_reports (
    report_id     int generated always as identity primary key,
    submitted_by  text not null,
    report_type   text not null,
    target_user_id text,
    subject       text not null,
    description   text not null,
    is_resolved   boolean not null default false,
    resolved_at   timestamptz,
    created_at    timestamptz not null default now()
);

create table if not exists audit_logs (
    log_id       int generated always as identity primary key,
    table_name   text not null,
    action       text not null,
    record_id    text,
    performed_by text,
    details      text,
    logged_at    timestamptz not null default now()
);

-- Tracks one-time admin bootstrap claims so a setup token
-- can never be replayed after the admin exists.
create table if not exists admin_bootstrap (
    id         int primary key default 1,
    claimed_by text not null references users(user_id),
    claimed_at timestamptz not null default now(),
    constraint ck_single_row check (id = 1)
);

-- ---------- INDEXES ------------------------------------------

create index if not exists ix_users_email         on users(email);
create index if not exists ix_users_cnic          on users(cnic);
create index if not exists ix_users_phone         on users(phone);
create index if not exists ix_users_role          on users(role_id);
create index if not exists ix_bookings_customer   on bookings(customer_id);
create index if not exists ix_bookings_status     on bookings(status_id);
create index if not exists ix_bookings_slot       on bookings(slot_id);
create index if not exists ix_time_slots_provider on time_slots(provider_id, slot_date);
create index if not exists ix_notifications_user  on notifications(user_id, is_read);
create index if not exists ix_audit_logs_table    on audit_logs(table_name, logged_at desc);
create index if not exists ix_services_provider   on services(provider_id);
create index if not exists ix_ratings_provider    on ratings(provider_id);
create index if not exists ix_ratings_customer    on ratings(customer_id);
create index if not exists ix_feedback_by         on feedback_reports(submitted_by);

-- ---------- SEED DATA ----------------------------------------

insert into roles (role_name)
values ('Admin'), ('Customer'), ('ServiceProvider')
on conflict (role_name) do nothing;

insert into booking_statuses (status_name)
values ('Pending'), ('Accepted'), ('Completed'), ('Cancelled'), ('Rejected')
on conflict (status_name) do nothing;

insert into service_categories (category_name)
values ('Electrician'), ('Plumber'), ('Mechanic'), ('Laundry'),
       ('Painter'), ('Carpenter'), ('Cleaner'), ('AC Repair'),
       ('Mason'), ('Gardener')
on conflict (category_name) do nothing;

-- =============================================================
--  FUNCTIONS  (ported from stored procedures / UDFs)
-- =============================================================

-- fn_GenerateUserID -> next_user_id()
create or replace function next_user_id()
returns text
language sql
as $$
    select 'SRV-' || lpad(
        (coalesce(max(substring(user_id from 5 for 5)::int), 0) + 1)::text, 5, '0')
    from users
    where user_id like 'SRV-%';
$$;

-- fn_GetCustomerBookingCount
create or replace function customer_booking_count(p_user_id text)
returns int
language sql
stable
as $$
    select coalesce(count(*), 0)::int from bookings where customer_id = p_user_id;
$$;

-- fn_GetProviderCompletedCount
create or replace function provider_completed_count(p_provider_id int)
returns int
language sql
stable
as $$
    select coalesce(count(*), 0)::int
    from bookings b
    join time_slots ts on b.slot_id = ts.slot_id
    where ts.provider_id = p_provider_id and b.status_id = 3;
$$;

-- sp_CreateBooking -> create_booking()
-- Business rules preserved exactly from the original procedure:
--   1. slot must be available
--   2. no more than 7 days in advance
--   3. slot must not be in the past
--   4. customer cannot double-book the same slot
--   5. slot is locked and the provider is notified
create or replace function create_booking(
    p_customer_id text,
    p_slot_id     int,
    p_service_id  int,
    p_notes       text default null
)
returns int
language plpgsql
as $$
declare
    v_slot_date        date;
    v_slot_start       time;
    v_is_available     boolean;
    v_booking_id       int;
    v_provider_user_id text;
begin
    select slot_date, start_time, is_available
      into v_slot_date, v_slot_start, v_is_available
      from time_slots
     where slot_id = p_slot_id
     for update;

    if not found then
        raise exception 'Selected time slot does not exist.';
    end if;

    if not v_is_available then
        raise exception 'Selected time slot is not available.';
    end if;

    if v_slot_date > (current_date + interval '7 days') then
        raise exception 'Booking can only be made up to 7 days in advance.';
    end if;

    if v_slot_date < current_date
       or (v_slot_date = current_date and v_slot_start < current_time) then
        raise exception 'Cannot book a past time slot.';
    end if;

    if exists (
        select 1 from bookings
         where customer_id = p_customer_id
           and slot_id = p_slot_id
           and status_id not in (4, 5)
    ) then
        raise exception 'You already have a booking for this slot.';
    end if;

    insert into bookings (customer_id, slot_id, service_id, status_id, notes)
    values (p_customer_id, p_slot_id, p_service_id, 1, p_notes)
    returning booking_id into v_booking_id;

    update time_slots set is_available = false where slot_id = p_slot_id;

    select u.user_id into v_provider_user_id
      from time_slots ts
      join service_providers sp on ts.provider_id = sp.provider_id
      join users u on sp.user_id = u.user_id
     where ts.slot_id = p_slot_id;

    insert into notifications (user_id, message)
    values (v_provider_user_id,
            'New booking request #' || v_booking_id || ' from customer ' || p_customer_id);

    return v_booking_id;
end;
$$;

-- sp_UpdateBookingStatus -> update_booking_status()
create or replace function update_booking_status(
    p_booking_id   int,
    p_new_status_id int,
    p_performed_by text
)
returns void
language plpgsql
as $$
declare
    v_old_status_id int;
    v_customer_id   text;
    v_slot_id       int;
    v_old_status    text;
    v_new_status    text;
    v_provider_user_id text;
begin
    select status_id, customer_id, slot_id
      into v_old_status_id, v_customer_id, v_slot_id
      from bookings
     where booking_id = p_booking_id
     for update;

    if not found then
        raise exception 'Booking not found.';
    end if;

    select status_name into v_old_status from booking_statuses where status_id = v_old_status_id;
    select status_name into v_new_status from booking_statuses where status_id = p_new_status_id;

    if v_new_status is null then
        raise exception 'Invalid booking status.';
    end if;

    update bookings
       set status_id = p_new_status_id, updated_at = now()
     where booking_id = p_booking_id;

    -- release the slot on cancellation or rejection
    if p_new_status_id in (4, 5) then
        update time_slots set is_available = true where slot_id = v_slot_id;
    end if;

    insert into notifications (user_id, message)
    values (v_customer_id,
            'Booking #' || p_booking_id || ' status changed: ' || v_old_status || ' -> ' || v_new_status);

    -- notify the provider when the customer cancels
    if p_new_status_id = 4 then
        select u.user_id into v_provider_user_id
          from time_slots ts
          join service_providers sp on ts.provider_id = sp.provider_id
          join users u on sp.user_id = u.user_id
         where ts.slot_id = v_slot_id;

        insert into notifications (user_id, message)
        values (v_provider_user_id,
                'Booking #' || p_booking_id || ' was cancelled by the customer.');
    end if;

    insert into audit_logs (table_name, action, record_id, performed_by, details)
    values ('bookings', 'STATUS_CHANGE', p_booking_id::text, p_performed_by,
            v_old_status || ' -> ' || v_new_status);
end;
$$;

-- sp_GetDashboardStats -> dashboard_stats()
create or replace function dashboard_stats()
returns table (
    total_customers    bigint,
    total_providers    bigint,
    pending_approvals  bigint,
    total_bookings     bigint,
    pending_bookings   bigint,
    completed_bookings bigint
)
language sql
stable
as $$
    select
        (select count(*) from users where role_id = 2),
        (select count(*) from users where role_id = 3),
        (select count(*) from service_providers where is_approved = false),
        (select count(*) from bookings),
        (select count(*) from bookings where status_id = 1),
        (select count(*) from bookings where status_id = 3);
$$;

-- =============================================================
--  TRIGGERS
-- =============================================================

create or replace function trg_audit_row()
returns trigger
language plpgsql
as $$
declare
    v_record_id text;
    v_details   text;
begin
    if tg_op = 'DELETE' then
        v_record_id := to_jsonb(old) ->> tg_argv[0];
        v_details   := to_jsonb(old)::text;
    else
        v_record_id := to_jsonb(new) ->> tg_argv[0];
        v_details   := to_jsonb(new)::text;
    end if;

    insert into audit_logs (table_name, action, record_id, details)
    values (tg_table_name, tg_op, v_record_id, left(v_details, 4000));

    return coalesce(new, old);
end;
$$;

drop trigger if exists bookings_audit on bookings;
create trigger bookings_audit
    after insert or update or delete on bookings
    for each row execute function trg_audit_row('booking_id');

drop trigger if exists users_audit on users;
create trigger users_audit
    after insert or update or delete on users
    for each row execute function trg_audit_row('user_id');

drop trigger if exists service_providers_audit on service_providers;
create trigger service_providers_audit
    after insert or update or delete on service_providers
    for each row execute function trg_audit_row('provider_id');

-- trg_UpdateAverageRating
create or replace function trg_refresh_average_rating()
returns trigger
language plpgsql
as $$
declare
    v_provider_id int := coalesce(new.provider_id, old.provider_id);
begin
    update service_providers
       set average_rating = coalesce(
            (select round(avg(stars)::numeric, 2) from ratings where provider_id = v_provider_id), 0)
     where provider_id = v_provider_id;
    return coalesce(new, old);
end;
$$;

drop trigger if exists ratings_refresh_avg on ratings;
create trigger ratings_refresh_avg
    after insert or update or delete on ratings
    for each row execute function trg_refresh_average_rating();

-- =============================================================
--  VIEWS
-- =============================================================

create or replace view vw_booking_summary as
select bs.status_name,
       count(b.booking_id) as total_bookings,
       current_date        as as_of_date
  from bookings b
  join booking_statuses bs on b.status_id = bs.status_id
 group by bs.status_name;

create or replace view vw_provider_booking_stats as
select sp.provider_id,
       u.full_name as provider_name,
       sc.category_name,
       count(b.booking_id)                                       as total_bookings,
       count(*) filter (where b.status_id = 3)                   as completed,
       count(*) filter (where b.status_id in (4, 5))             as cancelled_or_rejected,
       sp.average_rating
  from service_providers sp
  join users u              on sp.user_id     = u.user_id
  join service_categories sc on sp.category_id = sc.category_id
  left join time_slots ts   on ts.provider_id = sp.provider_id
  left join bookings b      on b.slot_id      = ts.slot_id
 group by sp.provider_id, u.full_name, sc.category_name, sp.average_rating;

-- =============================================================
--  ROW LEVEL SECURITY
--  The app connects with a privileged role and enforces
--  authorisation in server code, so RLS is enabled with no
--  permissive policies. This means that if the anon/public
--  Supabase key ever leaks, no table is readable through it.
-- =============================================================

alter table users             enable row level security;
alter table service_providers enable row level security;
alter table services          enable row level security;
alter table time_slots        enable row level security;
alter table bookings          enable row level security;
alter table notifications     enable row level security;
alter table ratings           enable row level security;
alter table feedback_reports  enable row level security;
alter table audit_logs        enable row level security;
alter table admin_bootstrap   enable row level security;
