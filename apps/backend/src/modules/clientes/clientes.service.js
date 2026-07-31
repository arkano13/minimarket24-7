import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const CLIENT_INCLUDE = {
  precios: {
    where: {
      activo: true,
    },
    include: {
      presentacion: {
        include: {
          producto: {
            select: {
              id: true,
              nombre: true,
              sku: true,
              activo: true,
            },
          },
          codigosBarra: {
            where: {
              activo: true,
            },
            orderBy: {
              principal: "desc",
            },
          },
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
};

function positiveInteger(value, field) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new AppError(`${field} no es válido.`, 400);
  }

  return number;
}

function positiveDecimal(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new AppError(
      `${field} debe ser mayor que cero.`,
      400,
    );
  }

  return new Prisma.Decimal(String(number));
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${field} es obligatorio.`, 400);
  }

  const text = value.trim().replace(/\s+/g, " ");

  if (text.length > maxLength) {
    throw new AppError(
      `${field} no puede superar ${maxLength} caracteres.`,
      400,
    );
  }

  return text;
}

function optionalText(value, field, maxLength) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const text = String(value)
    .trim()
    .replace(/\s+/g, " ");

  if (text.length > maxLength) {
    throw new AppError(
      `${field} no puede superar ${maxLength} caracteres.`,
      400,
    );
  }

  return text || null;
}

function serializeClient(client) {
  return {
    id: client.id,
    nombre: client.nombre,
    telefono: client.telefono,
    notas: client.notas,
    activo: client.activo,
    creadoEn: client.creadoEn,
    actualizadoEn: client.actualizadoEn,

    precios: client.precios.map((specialPrice) => ({
      id: specialPrice.id,
      presentacionId: specialPrice.presentacionId,
      precio: Number(specialPrice.precio),

      producto: {
        id: specialPrice.presentacion.producto.id,
        nombre:
          specialPrice.presentacion.producto.nombre,
        sku: specialPrice.presentacion.producto.sku,
      },

      presentacion: specialPrice.presentacion.nombre,
      tipoVenta: specialPrice.presentacion.tipo,
      precioNormal: Number(
        specialPrice.presentacion.precioBase,
      ),
      codigoBarra:
        specialPrice.presentacion.codigosBarra[0]
          ?.codigo ?? null,
    })),
  };
}

async function findClient(clientId, client = prisma) {
  return client.clienteEspecial.findUnique({
    where: {
      id: clientId,
    },
    include: CLIENT_INCLUDE,
  });
}

export async function listSpecialClients(search = "") {
  const term =
    typeof search === "string"
      ? search.trim()
      : "";

  const clients =
    await prisma.clienteEspecial.findMany({
      where: {
        activo: true,

        ...(term
          ? {
              OR: [
                {
                  nombre: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  telefono: {
                    contains: term,
                  },
                },
              ],
            }
          : {}),
      },

      include: CLIENT_INCLUDE,

      orderBy: {
        nombre: "asc",
      },

      take: 100,
    });

  return clients.map(serializeClient);
}

export async function createSpecialClient(data) {
  const name = requiredText(
    data.nombre,
    "El nombre",
    120,
  );

  const phone = optionalText(
    data.telefono,
    "El teléfono",
    30,
  );

  const notes = optionalText(
    data.notas,
    "Las notas",
    250,
  );

  const client =
    await prisma.clienteEspecial.create({
      data: {
        nombre: name,
        telefono: phone,
        notas: notes,
      },

      include: CLIENT_INCLUDE,
    });

  return serializeClient(client);
}

export async function updateSpecialClient(
  clientIdInput,
  data,
) {
  const clientId = positiveInteger(
    clientIdInput,
    "El cliente",
  );

  const currentClient =
    await prisma.clienteEspecial.findUnique({
      where: {
        id: clientId,
      },
    });

  if (!currentClient) {
    throw new AppError(
      "El cliente no existe.",
      404,
    );
  }

  const client =
    await prisma.clienteEspecial.update({
      where: {
        id: clientId,
      },

      data: {
        ...(data.nombre !== undefined
          ? {
              nombre: requiredText(
                data.nombre,
                "El nombre",
                120,
              ),
            }
          : {}),

        ...(data.telefono !== undefined
          ? {
              telefono: optionalText(
                data.telefono,
                "El teléfono",
                30,
              ),
            }
          : {}),

        ...(data.notas !== undefined
          ? {
              notas: optionalText(
                data.notas,
                "Las notas",
                250,
              ),
            }
          : {}),

        ...(typeof data.activo === "boolean"
          ? {
              activo: data.activo,
            }
          : {}),
      },

      include: CLIENT_INCLUDE,
    });

  return serializeClient(client);
}

export async function searchProductsForSpecialPrice(
  search = "",
) {
  const term =
    typeof search === "string"
      ? search.trim()
      : "";

  if (!term) {
    return [];
  }

  const presentations =
    await prisma.presentacionProducto.findMany({
      where: {
        activo: true,

        producto: {
          activo: true,
        },

        OR: [
          {
            producto: {
              nombre: {
                contains: term,
                mode: "insensitive",
              },
            },
          },

          {
            producto: {
              sku: {
                contains: term,
                mode: "insensitive",
              },
            },
          },

          {
            codigosBarra: {
              some: {
                activo: true,
                codigo: {
                  contains: term,
                },
              },
            },
          },
        ],
      },

      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            sku: true,
          },
        },

        codigosBarra: {
          where: {
            activo: true,
          },

          orderBy: {
            principal: "desc",
          },
        },
      },

      orderBy: [
        {
          producto: {
            nombre: "asc",
          },
        },
        {
          id: "asc",
        },
      ],

      take: 30,
    });

  return presentations.map((presentation) => ({
    presentacionId: presentation.id,
    productoId: presentation.producto.id,
    nombre: presentation.producto.nombre,
    sku: presentation.producto.sku,
    presentacion: presentation.nombre,
    tipoVenta: presentation.tipo,
    precioNormal: Number(
      presentation.precioBase,
    ),
    codigoBarra:
      presentation.codigosBarra[0]?.codigo ??
      null,
  }));
}

export async function setSpecialPrice(
  clientIdInput,
  data,
) {
  const clientId = positiveInteger(
    clientIdInput,
    "El cliente",
  );

  const presentationId = positiveInteger(
    data.presentacionId,
    "La presentación",
  );

  const price = positiveDecimal(
    data.precio,
    "El precio especial",
  );

  return prisma.$transaction(
    async (transaction) => {
      const [client, presentation] =
        await Promise.all([
          transaction.clienteEspecial.findFirst({
            where: {
              id: clientId,
              activo: true,
            },

            select: {
              id: true,
            },
          }),

          transaction.presentacionProducto.findFirst({
            where: {
              id: presentationId,
              activo: true,

              producto: {
                activo: true,
              },
            },

            select: {
              id: true,
            },
          }),
        ]);

      if (!client) {
        throw new AppError(
          "El cliente no existe o está inactivo.",
          404,
        );
      }

      if (!presentation) {
        throw new AppError(
          "El producto no existe o está inactivo.",
          404,
        );
      }

      await transaction.precioEspecialCliente.upsert({
        where: {
          clienteId_presentacionId: {
            clienteId: clientId,
            presentacionId: presentationId,
          },
        },

        update: {
          precio: price,
          activo: true,
        },

        create: {
          clienteId: clientId,
          presentacionId: presentationId,
          precio: price,
        },
      });

      const updatedClient = await findClient(
        clientId,
        transaction,
      );

      return serializeClient(updatedClient);
    },
  );
}

export async function removeSpecialPrice(
  clientIdInput,
  presentationIdInput,
) {
  const clientId = positiveInteger(
    clientIdInput,
    "El cliente",
  );

  const presentationId = positiveInteger(
    presentationIdInput,
    "La presentación",
  );

  return prisma.$transaction(
    async (transaction) => {
      const specialPrice =
        await transaction.precioEspecialCliente.findUnique(
          {
            where: {
              clienteId_presentacionId: {
                clienteId: clientId,
                presentacionId: presentationId,
              },
            },
          },
        );

      if (!specialPrice) {
        throw new AppError(
          "El precio especial no existe.",
          404,
        );
      }

      await transaction.precioEspecialCliente.update({
        where: {
          id: specialPrice.id,
        },

        data: {
          activo: false,
        },
      });

      const updatedClient = await findClient(
        clientId,
        transaction,
      );

      return serializeClient(updatedClient);
    },
  );
}