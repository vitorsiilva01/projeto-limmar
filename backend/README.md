UsinagemLimmar - Backend scaffold

Passos rápidos para usar com XAMPP/MySQL local:

1. Abra o XAMPP e inicie o MySQL.
2. Crie o banco e tabelas usando `init.sql` via phpMyAdmin ou linha de comando:
   - phpMyAdmin: importe `backend/init.sql`.
   - ou: mysql -u root -p < backend/init.sql
3. Configure `backend/server.js` (DB_CONFIG) se necessário (usuário/senha/host).
4. Instale dependências:
   npm install
5. Inicie o servidor:
   npm start

Endpoints iniciais:
- GET /api/tools -> lista ferramentas
- POST /api/tools -> cria ferramenta (body: { code, description })

Autenticação / JWT
- O backend agora emite JWT no registro/login e protege endpoints de escrita (POST). Use a variável de ambiente `JWT_SECRET` para configurar a chave secreta em produção.
- Exemplo de variáveis de ambiente (opcional):
   - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
   - JWT_SECRET

Exemplo: executar com variável JWT_SECRET no PowerShell:
```powershell
 $env:JWT_SECRET = "minha-chave-secreta"; node server.js
```

Observação: este é um scaffold. Expanda com endpoints de registros, falhas e geração de relatórios.

Modo de desenvolvimento sem MySQL
--------------------------------
Se você quiser rodar o backend rapidamente sem configurar MySQL/XAMPP, defina a variável de ambiente `DEV_NO_DB=1`.
Nesse modo o servidor usará armazenamento em memória (não persistente) e permitirá testar endpoints como `/api/reports/summary` e `/api/reports/export`.

Exemplo no PowerShell (dev mode):
```powershell
 $env:DEV_NO_DB = "1"
 $env:JWT_SECRET = "minha-chave-secreta"
 node server.js
```

Credenciais de teste (dev mode)
--------------------------------
Quando `DEV_NO_DB=1` o backend injeta um usuário de teste com as seguintes credenciais:
- CPF: `00000000000`
- Senha: `password`

Use essas credenciais na tela de login para obter o JWT em modo de desenvolvimento.

Scripts úteis
------------
- Instalar dependências: `npm install`
- Iniciar servidor: `npm start` (usa `node server.js`)

Checklist antes de testar com MySQL
----------------------------------
1. Inicie o MySQL (XAMPP) e importe `backend/init.sql` (via phpMyAdmin ou `mysql -u root < backend/init.sql`).
2. Ajuste variáveis de ambiente se necessário: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
3. Inicie o servidor e verifique `http://localhost:3001/` retorna `{ status: 'ok' }`.

Se preferir não configurar o MySQL agora, use `DEV_NO_DB=1` para rodar e testar a API localmente.
