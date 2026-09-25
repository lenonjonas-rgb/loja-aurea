# Publicacao da loja

## 1. Supabase

1. Crie um projeto em [Supabase](https://supabase.com/dashboard).
2. Em **SQL Editor**, execute o arquivo `supabase/schema.sql`.
3. Em **Storage**, crie o bucket privado `invoices` para notas fiscais.
4. Em **Project Settings > API**, copie a URL do projeto e a chave `anon`.
5. Copie `.env.example` para `.env.local` e informe os valores. Nunca publique esse arquivo.

## 2. GitHub

1. Crie um repositório vazio chamado `loja-aurea` no GitHub, sem README.
2. No terminal do projeto, execute:

```powershell
git add .
git commit -m "Publica loja Aurea"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/loja-aurea.git
git push -u origin main
```

## 3. Vercel

1. Acesse [Vercel](https://vercel.com/new) e importe o repositório `loja-aurea`.
2. Mantenha o framework como **Other** e não configure comando de build nem diretório de saída.
3. Em **Environment Variables**, crie `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os valores do Supabase.
4. Clique em **Deploy**. A página inicial será `index.html` e o painel será `/admin`.

## Importante

O site atual usa `localStorage` como demonstração. O schema, as variáveis e o deploy estão prontos; para dados compartilhados entre clientes e administração, o próximo passo é substituir a persistência local pelas consultas Supabase e proteger o painel administrativo com papéis de usuário.