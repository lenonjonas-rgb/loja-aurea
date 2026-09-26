# Publicacao da loja

## 1. Supabase

1. Crie um projeto em [Supabase](https://supabase.com/dashboard).
2. Para um projeto novo, execute as migrações SQL numeradas em ordem. Se o projeto já recebeu a migração 008, execute `supabase/009_tax_reference_settings.sql` e depois `supabase/010_staff_permissions_product_codes_addresses.sql`.
3. Em **Authentication > Users**, crie a usuária administradora e execute `supabase/003_create_store_owner.sql` no SQL Editor.
4. Em **Storage**, crie o bucket privado `invoices` para notas fiscais.
5. Em **Project Settings > API**, copie a URL do projeto e a chave `anon`.
6. Em **Authentication > URL Configuration**, configure a URL do site publicado como Site URL e inclua a URL do site na lista de Redirect URLs para confirmação de conta e recuperação de senha.
7. Copie `.env.example` para `.env.local` e informe os valores. Nunca publique esse arquivo.

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

As métricas financeiras usam pedidos pagos presentes em `public.orders`, itens em `public.order_items` e despesas registradas. O total de impostos considera somente `tax_amount` registrado no pedido; os parâmetros fiscais configurados não são usados para estimar nem apurar tributos. Pedidos criados apenas no armazenamento local não entram nos relatórios financeiros.

A migration 010 promove para nível 3 os perfis que já tinham `role = 'admin'`. Usuários criados diretamente em Supabase Auth sem perfil aparecem como clientes até que um administrador nível 3 lhes atribua um nível no painel. Níveis 1 e 2 ficam limitados por políticas RLS e validação de campos logísticos no banco.

Cadastros de produto exigem NCM com 8 dígitos. CEST é preenchido quando aplicável; origem fiscal, GTIN e CST de ICMS/PIS/COFINS/IPI são campos de referência. CFOP depende da operação, e a loja não calcula/apura automaticamente os tributos a partir desses códigos.