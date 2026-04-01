create schema if not exists extensions;

create extension if not exists pgcrypto with schema public;
create extension if not exists postgis with schema public;
create extension if not exists vector with schema public;
create extension if not exists cube with schema public;
create extension if not exists earthdistance with schema public;
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema extensions;
