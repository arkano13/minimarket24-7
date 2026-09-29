# Velocidad de la búsqueda de productos

Medido con PostgreSQL 16 local y 5 000 productos (6 666 presentaciones): la búsqueda completa tarda 15–35 ms dentro del servidor y la consulta SQL ~10 ms. La base no es el cuello de botella con un catálogo de este tamaño; los índices trigram no mejoran la consulta.

Cambios:

- **Conexiones a Postgres abiertas** (`src/lib/prisma.js`). `pg` cerraba las conexiones tras 10 s sin uso; la primera búsqueda después de una pausa tenía que reconectarse (en local pasaba de ~25 ms a ~45 ms; en Railway la diferencia es mayor). Ahora duran 10 minutos (`DB_IDLE_TIMEOUT_MS`) con keepAlive.
- **Sin búsquedas duplicadas en la caja** (`VentasPage.jsx`). Al escanear, el Enter y el temporizador de escritura pedían lo mismo dos veces; ahora la segunda reutiliza la primera.
- **Log de peticiones lentas**: cualquier petición que tarde 800 ms o más (`SLOW_REQUEST_MS`) aparece en el log de Railway como `Petición lenta: ...`. Si la caja se siente lenta y no aparece nada, la demora está en la red (internet de la tienda o distancia a la región de Railway), no en el servidor.

En Railway, verificar que **backend y Postgres estén en la misma región**: cada búsqueda hace varias consultas seguidas a la base y, entre regiones distintas, cada una suma decenas de milisegundos.
