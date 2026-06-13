import { config } from 'dotenv';

import { defineConfig } from 'prisma/config';

config({ path: '../.env' });
config();

const databaseUrl =
  process.env.DATABASE_URL ??
  'sqlserver://localhost:1434;database=loanslam;user=sa;password=LocalDev!Passw0rd;trustServerCertificate=true';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
