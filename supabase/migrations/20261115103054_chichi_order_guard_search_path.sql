create or replace function public.chichi_set_order_price_from_listing()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare listing_row public.chichi_listings%rowtype;
begin
 if new.listing_id is null then raise exception 'A marketplace listing is required for a website purchase request'; end if;
 select * into listing_row from public.chichi_listings where id=new.listing_id and review_status='approved';
 if not found then raise exception 'This website listing is not available for purchase'; end if;
 new.item_name := listing_row.title;
 new.amount_kobo := listing_row.price_kobo;
 new.currency := listing_row.currency;
 return new;
end;
$$;
