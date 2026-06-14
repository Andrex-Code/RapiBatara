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
3. Usa la publishable key de Supabase en `VITE_SUPABASE_ANON_KEY`; nunca uses una `secret` key en variables `VITE_` porque quedan visibles en el navegador.
4. Ejecuta la migración en `supabase/migrations/0001_initial_schema.sql`.

El prototipo funciona con datos locales mientras Supabase no esté configurado.

## Acceso operativo

- Usuario inicial del tendero: `rapitienda`
- Contraseña inicial: `123456`
- En producción, el login usa Supabase Auth y el tendero puede cambiar la contraseña desde `Cuenta`.
- Cambia la contraseña inicial apenas entregues la app al negocio.
