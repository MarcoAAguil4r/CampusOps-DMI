# ADR-001: Arquitectura por capas con puertos y adaptadores

- Estado: aceptada
- Fecha: 2026-09-12
- Alcance: semana 2 de CampusOps

## Contexto

CampusOps debe soportar incidencias, sesión, persistencia local y proveedores
externos sin atar la interfaz a un proveedor concreto. La aplicación debe poder
probar reglas con datos ficticios y sustituir los adaptadores durante las
pruebas. React Native, Expo y TypeScript ya están definidos y no forman parte
de esta decisión.

## Alternativas consideradas

### Alternativa A: arquitectura por capas con puertos y adaptadores

La UI invoca casos de uso de `application`. La capa de aplicación coordina el
flujo y depende de contratos del `domain`. Los adaptadores concretos viven en
`infrastructure` y se inyectan mediante esos contratos.

### Alternativa B: arquitectura por funcionalidad con acceso directo a servicios

Cada pantalla agrupa su estado, reglas y llamadas HTTP o almacenamiento. Es
rápida para un prototipo pequeño, pero cada pantalla conoce detalles externos y
las pruebas necesitan sustituir más comportamiento concreto.

## Decisión

Elegimos la alternativa A. Los límites serán `ui`, `application`, `domain` e
`infrastructure`. Las dependencias permitidas apuntan hacia los contratos del
dominio: `ui -> application -> domain`, mientras que los adaptadores de
`infrastructure` implementan esos contratos. La composición concreta se hará
en el punto de entrada, sin que la UI importe infraestructura directamente.

Los límites funcionales se mantienen dentro de esos módulos: incidencias y
sus estados pertenecen al dominio; sesión, persistencia y ubicación se
exponen mediante puertos; la aplicación coordina los casos de uso; la UI
presenta estados y acciones.

## Consecuencias

El beneficio principal es que las reglas de incidencias se pueden probar sin
React Native, red o almacenamiento real. Un proveedor de backend, persistencia
o ubicación puede cambiarse implementando el mismo contrato. También queda
visible la dirección de dependencias y se reduce el acoplamiento de las
pantallas.

El costo es crear interfaces, una composición inicial y adaptadores pequeños
antes de añadir cada proveedor. El código puede tener más archivos que una
pantalla monolítica. El chequeo de salud existente en `App.tsx` es una
dependencia heredada que deberá pasar por un caso de uso de aplicación en la
implementación del esqueleto; se conservará su comportamiento observable.

## Comprobación prevista

La prueba pública de semana 2 comprueba que el diagrama declara los cuatro
límites y no dibuja una dependencia directa de `ui` a `infrastructure`. El
reporte de dependencias contrastará después ese dibujo con los imports reales
y registrará cualquier contradicción corregida.