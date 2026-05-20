import path from 'path';

export default ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  const connections = {
    postgres: {
      connection: env('DATABASE_URL')
        ? {
            connectionString: env('DATABASE_URL'),
            schema: env('DATABASE_SCHEMA', 'public'),
            ssl: env.bool('DATABASE_SSL', false)
              ? {
                  rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
                }
              : false,
          }
        : {
            host: env('DATABASE_HOST', 'localhost'),
            port: env.int('DATABASE_PORT', 5432),
            database: env('DATABASE_NAME', 'idambox'),
            user: env('DATABASE_USERNAME', 'idambox'),
            password: env('DATABASE_PASSWORD', 'idambox'),
            schema: env('DATABASE_SCHEMA', 'public'),
            ssl: env.bool('DATABASE_SSL', false)
              ? {
                  rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
                }
              : false,
          },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 0),
        max: env.int('DATABASE_POOL_MAX', 10),
      },
    },
    sqlite: {
      connection: {
        filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  const connectionConfig = connections[client];

  if (!connectionConfig) {
    throw new Error(`Invalid DATABASE_CLIENT: ${client}. Must be one of: ${Object.keys(connections).join(', ')}`);
  }

  return {
    connection: {
      client,
      connection: connectionConfig.connection,
      pool: connectionConfig.pool,
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 10000),
    },
  };
};
