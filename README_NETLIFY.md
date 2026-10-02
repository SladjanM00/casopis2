# Školski časopis - Blagoje Radić

Finalna Netlify verzija projekta — V15 (4 časopisa po stranici + responsive 2x2 mobilni grid).

## Struktura

- `public/` - javni deo sajta
- `netlify/functions/` - serverske funkcije
- Netlify Blobs - čuvanje časopisa i naslovnica
- `/admin` - admin panel
- `/` - javni dashboard

## Netlify Environment Variables

U Netlify-u treba da postoje samo:

```text
ADMIN_PASSWORD_HASH=<hash lozinke>
SESSION_SECRET=<duga nasumična vrednost>
```

Nemoj dodavati raw admin lozinku u GitHub fajlove.
Nemoj dodavati `.env` fajlove u GitHub.

Korisničko ime administratora je podešeno serverski.

## GitHub

Raspakuj projekat i u repository ubaci SADRŽAJ foldera, ne ZIP fajl.

Preporuka:
1. Obriši stare fajlove iz radne kopije repozitorijuma.
2. Kopiraj sve fajlove iz ove finalne verzije.
3. `git add -A`
4. `git commit -m "Final Netlify version"`
5. `git push`

`.gitignore` već isključuje `.env`, `.env.*`, ZIP fajlove, `.netlify` i `node_modules`.

## Netlify

`netlify.toml` je već podešen:

```text
publish = public
functions = netlify/functions
```

Nije potreban `dist` folder.

Ako je postojeći Netlify projekat već povezan sa GitHub repository-jem,
novi `git push` automatski pokreće deploy.

## Admin

Admin panel:
`/admin`

Na javnoj početnoj strani nema Admin dugmeta.
