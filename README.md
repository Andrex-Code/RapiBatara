# RapiBatará

App operativa para una tienda de conjunto cerrado: catálogo, carrito, pagos, aprobación del tendero, inventario y despacho.

## Stack

- Vite + React + TypeScript
- Supabase Auth, Postgres, Storage, Realtime y Edge Functions como backend recomendado
- CSS propio con tokens de marca, mobile-first y layout responsive

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Supabase

1. Crea un proyecto en Supabase.
2. Copia `.env.example` a `.env.local` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Ejecuta la migración en `supabase/migrations/0001_initial_schema.sql`.

El prototipo funciona con datos locales mientras Supabase no esté configurado.
