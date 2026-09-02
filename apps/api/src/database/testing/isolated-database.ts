import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { createDatabase } from "../database";
import { migrateToLatest } from "../migrator";

export interface IsolatedDatabase {
  connectionString: string;
  drop(): Promise<void>;
}

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

async function runOnServer(connectionString: string, statement: string): Promise<void> {
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

function withDatabaseName(connectionString: string, name: string): string {
  const url = new URL(connectionString);

  url.pathname = `/${name}`;

  return url.toString();
}

export async function createIsolatedDatabase(serverConnectionString: string): Promise<IsolatedDatabase> {
  const name = `helpmegethired_test_${randomUUID().replaceAll("-", "")}`;
  const connectionString = withDatabaseName(serverConnectionString, name);

  await runOnServer(serverConnectionString, `create database ${quote(name)}`);

  const database = createDatabase(connectionString);

  try {
    const { error } = await migrateToLatest(database);

    if (error) {
      throw error;
    }
  } finally {
    await database.destroy();
  }

  return {
    connectionString,
    drop: () => runOnServer(serverConnectionString, `drop database ${quote(name)} with (force)`),
  };
}
