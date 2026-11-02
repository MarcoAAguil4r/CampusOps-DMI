# Semana 9 — política de resiliencia y ubicación

## Proveedor y datos

La integración usa la API pública de búsqueda de Nominatim de OpenStreetMap
(`https://nominatim.openstreetmap.org/search`) para convertir una referencia
escrita por la persona en una etiqueta y coordenadas. El endpoint puede
configurarse con `EXPO_PUBLIC_GEOCODING_URL` para entornos controlados. La
solicitud usa texto de ubicación escrito manualmente; no recoge ni envía la
posición GPS del dispositivo.

Nominatim es un servicio comunitario sujeto a su política de uso: se identifica
el cliente, se limita la frecuencia a una solicitud por segundo por instancia y
se cachean resultados válidos durante cinco minutos. No se hacen solicitudes en
segundo plano, en lote o para datos sensibles, y la aplicación debe mantener
una alternativa manual. El equipo debe revisar los términos vigentes del
proveedor antes de cualquier despliegue fuera del ejercicio. La respuesta del
proveedor no es una verificación de una dirección ni una garantía de exactitud.

## Cache y validación

`CachedGeocodingAdapter` comparte búsquedas simultáneas de la misma referencia
y conserva únicamente resultados válidos de proveedor. Normaliza espacios y
mayúsculas en la clave, expira las entradas tras cinco minutos y limita la
memoria a 100 resultados; un fallo o una respuesta sin coincidencias no se
cachea. `selectIncidentLocation` acepta sólo etiqueta no vacía y coordenadas
numéricas finitas dentro de rango. Si la respuesta no cumple el contrato, se
conserva el texto manual sin inventar coordenadas.

## Fallos y pruebas

Timeouts, desconexiones, respuestas HTTP no exitosas (incluido 429) y contratos
malformados se propagan como errores explícitos desde el adaptador; la capa que
llama puede presentar la alternativa manual. Para un error HTTP, el adaptador
conserva `Retry-After` en `HttpStatusError.retryAfterMs`; el parser acepta
segundos o una fecha HTTP, convierte ambos formatos a milisegundos, limita la
demora al máximo representable por un temporizador y devuelve `null` ante un
encabezado ausente o inválido. El adaptador no ejecuta reintentos: la política
de reintentos sigue en la capa correspondiente.

Las pruebas unitarias usan un `fetch` sustituido y las variantes del endpoint
CampusOps `GET /v1/geocoding` (`success`, `rate_limited`, `slow`,
`invalid_coordinates`, `incomplete` y `timeout`). Esos escenarios reproducibles
no cuentan como ejecución contra Nominatim. La evidencia de una ejecución
real contra el backend controlado local, usando `fetch` real de Node y la
referencia ficticia `Zona ficticia`, quedó reproducida con:

```bash
npm run test:geocoding-live
```

Resultado observado: **PASS**; el adaptador obtuvo la ubicación sintética
`Edificio de prueba A` y recibió HTTP 429 con `retryAfterMs = 1000`. Esta
comprobación no consulta Nominatim ni se presenta como una ejecución externa.
