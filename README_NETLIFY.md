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

## V16
- Po 4 časopisa po stranici.
- Desktop: 4 kartice u jednom redu.
- Tablet/mobilni: 2x2 grid.
- Mobilne kartice su kompaktnije: opis je sakriven, informacije su zbijenije, a dugmad su jedno pored drugog.


## V17
- Posle objave admin stranica se automatski osvežava i upload forma je čista za sledeći PDF.
- Ako je javni dashboard otvoren u drugom tabu, osvežava se nakon objave/brisanja.
- Admin lista prikazuje samo poslednja 3 časopisa; dugme „Prikaži sve“ otkriva starije.

## V18
- Admin lista koristi paginaciju po 3 časopisa; više nema prikaza svih časopisa u dugačkoj koloni.
- Javni dashboard je redizajniran u svetlijem Apple-inspirisanom stilu za osnovnu školu.
- Paleta je svedena na neutralnu svetlu osnovu, plavu i nežno svetloplavu.


## V19
- Javni dashboard je redizajniran da sadržaj bude prvenstveno usmeren na časopise.
- Uklonjeni su veliki odvojeni hero/library paneli.
- Časopisi su prikazani kao profesionalna Apple-inspired biblioteka sa naslovnicama u prvom planu.
- Mobilni prikaz ostaje 2 kolone, desktop 4 kolone, uz paginaciju.


## V21 izmene
- Jasniji logo i naziv škole u headeru
- Apple-like dugme za zvanični sajt škole
- Stilizovan glass footer

## V22
- Soft blue minimal stil početne strane.
- Ispravljeno preklapanje naziva škole i dugmeta na mobilnim ekranima.
- Kompaktno Apple-like dugme za zvanični sajt škole.
- Footer je pojednostavljen i prilagođen telefonima.
