# Mise en ligne permanente

## 1. Preparer Supabase

1. Ouvre ton projet Supabase.
2. Va dans `SQL Editor`.
3. Copie-colle le contenu de `supabase-schema.sql`.
4. Lance la requete.

## 2. Recuperer les 2 infos importantes

Dans Supabase :

1. Va dans `Project Settings` puis `API`.
2. Copie :
   - `Project URL`
   - `service_role` key

Garde aussi ton code admin si tu veux le changer :

- `ADMIN_CODE`

## 3. Mettre le serveur sur Render

1. Ouvre Render.
2. Clique sur `New` puis `Blueprint`.
3. Connecte ton GitHub si besoin.
4. Choisis le depot `leandre23pixels/emotiometre`.
5. Render detectera `render.yaml`.
6. Renseigne les variables :
   - `ADMIN_CODE`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Lance le deploy.

## 4. Recuperer ton lien

Quand le deploy est fini, Render te donne une adresse en `https://...onrender.com`.

Ce sera ton vrai lien public.

## 5. Important

- Le serveur restera en ligne meme si ton PC est eteint.
- En gratuit, Render peut mettre le site en veille apres un moment sans visite.
- Au premier clic apres une veille, il peut y avoir un petit temps d'attente.
