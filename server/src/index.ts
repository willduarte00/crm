import { app } from './app.js';
import { env } from './env.js';

app.listen(env.PORT, () => {
  console.log(`🚀 Servidor CRM rodando na porta ${env.PORT} [${env.NODE_ENV}]`);
});
