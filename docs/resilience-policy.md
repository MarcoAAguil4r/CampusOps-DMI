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
llama puede presentar la alternativa manual. No se reintenta aquí: la política
de reintentos y `Retry-After` se integra por separado.

Las pruebas unitarias usan un `fetch` sustituido y las variantes del endpoint
CampusOps `GET /v1/geocoding` (`success`, `rate_limited`, `slow`,
`invalid_coordinates`, `incomplete` y `timeout`). Esos escenarios reproducibles
no cuentan como ejecución contra Nominatim. La evidencia de una ejecución
externa real con texto ficticio debe añadirse después de verificarla en el
entorno del equipo; no se declara ejecutada en este documento.
