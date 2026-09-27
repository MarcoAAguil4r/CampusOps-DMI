# Controles de seguridad y privacidad - Semana 4

## Alcance y amenazas

Este control responde a los activos A-01 (sesiones), A-03 (ubicaciones, fotografias y notas) y A-05 (registros y credenciales), y a la frontera F-05 del [modelo de amenazas](threat-model.md). La app todavia no implementa inicio de sesion ni guarda tokens; `UserSession` contiene unicamente un identificador sintetico y un rol. El control de almacenamiento queda implementado en un adaptador reutilizable, pero aun no esta conectado a un flujo de autenticacion.

## Decision de almacenamiento

Se eligio `expo-secure-store` para persistir una sesion cuando se incorpore el flujo de autenticacion. En iOS se solicita accesibilidad `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; en Android la biblioteca usa almacenamiento respaldado por Android Keystore. `SecureSessionAdapter` solo serializa los campos permitidos `userId` y `role`, valida el rol al leer y al escribir, elimina datos corruptos y ofrece una operacion explicita de cierre/borrado. Los errores del modulo nativo se propagan: no hay fallback a AsyncStorage, archivos ni texto plano.

Alternativas descartadas:

- AsyncStorage o JSON en archivos son sencillos, pero no ofrecen almacenamiento cifrado de credenciales por si mismos.
- Mantener la sesion solo en memoria evita persistencia, pero no permite recuperarla tras reiniciar; sigue siendo la alternativa usada mientras no exista login.

Beneficio: el adaptador usa el almacen de credenciales del sistema y limita los datos persistidos. Costo: depende de capacidades nativas Android/iOS y requiere probar el build nativo; los valores leidos siguen existiendo en memoria durante el uso.

## Secretos y registros

La busqueda del repositorio no encontro claves privadas, tokens de proveedores ni credenciales reales. Los valores `course-valid-token` y `course-refresh-*` son fixtures publicos del backend didactico, no secretos; no deben reemplazarse por credenciales reales. `.env` esta excluido por `.gitignore`; `.env.example` solo contiene configuracion local sin credenciales. No se anadieron llamadas de consola ni mensajes que incluyan datos de sesion.

## Riesgo residual

El adaptador no constituye un login, no autentica ni revoca sesiones y actualmente no es consumido por la interfaz. Un dispositivo comprometido, codigo malicioso ejecutado dentro de la app o datos ya leidos en memoria pueden exponer la sesion. Antes de usar credenciales reales se debe integrar expiracion, renovacion y revocacion, auditar el backend y exigir TLS fuera del simulador local. El escaneo de secretos debe repetirse sobre el commit final.

La auditoria `npm run audit:ci` finalizo con exito bajo el umbral configurado de vulnerabilidades criticas, pero reporto dos advisories `high` transitivos en `@xmldom/xmldom` y `js-yaml`. Se registran como riesgo de dependencias pendiente de revision antes de distribuir; no se actualizaron aqui porque no son causados por el control de sesion y requieren una decision separada.

## Verificacion

`src/infrastructure/SecureSessionAdapter.test.ts` comprueba persistencia solo de campos permitidos, accesibilidad restringida, rechazo de roles invalidos, limpieza de valores corruptos y borrado de sesion. El test usa un sustituto de almacenamiento: valida la politica y el contrato del adaptador, no reemplaza una prueba en dispositivo Android/iOS.