import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { ProveedorDeBaseDeDatos } from "../../../src/infrastructure/persistence/proveedor-db.js";
import { migrar } from "../../../src/infrastructure/persistence/migrar.js";

export interface PostgresDePrueba {
  proveedor: ProveedorDeBaseDeDatos;
  url: string;
  cerrar(): Promise<void>;
}

export async function arrancarPostgresDePrueba(): Promise<PostgresDePrueba> {
  const container: StartedTestContainer = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
      POSTGRES_DB: "tracking",
    })
    .withExposedPorts(5432)
    .start();

  const url = `postgres://test:test@${container.getHost()}:${container.getMappedPort(5432)}/tracking`;
  const proveedor = new ProveedorDeBaseDeDatos(url, false);
  await migrar(proveedor.obtener());
  return {
    proveedor,
    url,
    cerrar: async () => {
      await proveedor.cerrar();
      await container.stop();
    },
  };
}
