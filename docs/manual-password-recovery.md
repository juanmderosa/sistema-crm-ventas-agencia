# Prueba manual de recuperación de contraseña

## Preparación local

Usá una cuenta de prueba que ya exista en **Authentication → Users**. No hace falta cargar perfiles, agencias ni membresías: este flujo solo modifica Auth. No hay SQL de preparación ni de limpieza para esta prueba. No uses una cuenta real ni compartas su enlace.

1. Configurá `APP_ORIGIN=http://127.0.0.1:3000` en `.env.local`, junto con la URL de API y la clave pública de Supabase. Si abrís la app en `localhost`, usá `http://localhost:3000` como origen. Debe ser solo el origen, sin barra final ni ruta.
2. La configuración versionada incorpora contraseña mínima de ocho caracteres y la plantilla `supabase/templates/recovery.html`. Para aplicarla a una instancia ya iniciada: `npm run db:stop` y `npm run db:start`. Se conservan los volúmenes; no uses reset ni `--no-backup`.
3. Ejecutá `npm run dev` y abrí la app en el origen configurado. La bandeja local es [Mailpit](http://127.0.0.1:54324). Los correos locales no llegan a Internet.

La configuración de Next permite explícitamente `127.0.0.1` durante desarrollo, además de `localhost`. Tras actualizar `next.config.ts`, reiniciá `npm run dev` si no se reinició automáticamente y recargá la página. Si la conexión de desarrollo está bloqueada, React no termina de hidratar y los formularios permanecen deshabilitados; no se debe quitar su protección de hidratación para ocultar ese error.

## Recorrido principal

1. En `/login`, pulsá **Olvidé mi contraseña**. Enviá el correo de tu cuenta de prueba.
2. Debe aparecer: “Si existe una cuenta con ese correo, recibirás un enlace…”. Repetí con un correo inexistente: debe mostrarse el mismo mensaje. Si Auth limita intentos o falla el servicio, debe aparecer un error, sin fingir que se envió el correo.
3. En Mailpit, abrí el correo **Recuperá tu contraseña** correspondiente a tu cuenta. Copiá el enlace y abrilo en otro navegador o ventana privada.
4. Debe aparecer **Nueva contraseña**. Podés recargar: visitar el enlace todavía no lo consume. La autenticidad y vigencia se comprueban al guardar.
5. Probá siete caracteres y luego una confirmación diferente: deben aparecer errores. Guardá una contraseña nueva de al menos ocho caracteres, distinta de la anterior.
6. Debe volver a `/login?recovered=1` y mostrar **Contraseña actualizada**. `/cuenta` debe pedir ingreso: la recuperación no deja una sesión del panel abierta.
7. La contraseña anterior debe fallar y la nueva debe permitir ingresar. El acceso depende de las membresías actuales; una cuenta sin membresías verá el estado sin acceso habilitado.

## Casos negativos y aislamiento

- Volvé al mismo enlace y enviá otra contraseña: debe indicar enlace inválido, vencido o utilizado. La contraseña ya guardada debe seguir funcionando.
- Abrí `/recuperar/confirmar` sin token, con `?token_hash=incorrecto` y con el parámetro repetido: no debe aparecer el formulario habilitado para guardar.
- Cambiá un carácter del token original, conservando su longitud: al guardar debe ser rechazado.
- Solicitá otro enlace y esperá más de una hora antes de enviarlo: debe ser rechazado como inválido/vencido/utilizado. Este paso verifica el vencimiento real; una prueba rápida con token alterado no lo reemplaza.
- Agregá `&next=https://example.org` al enlace: el resultado debe permanecer en la aplicación. No se aceptan destinos enviados por el navegador.
- Abrí un enlace de la cuenta A en un navegador con la cuenta B iniciada. Solo debe cambiar la contraseña de A; al finalizar también se cierra la sesión del navegador. La contraseña de B debe conservarse.
- Una sesión común, sin un enlace de recuperación válido, no autoriza el cambio mediante este formulario.

## Después de probar

La contraseña cambiada permanece en Auth. No hay filas de negocio que borrar. Si querés conservar la cuenta de prueba, recordá su nueva contraseña o repetí la recuperación. No borres usuarios ni perfiles para “limpiar” esta prueba. Los fixtures automáticos usan identidades sintéticas propias y las retiran al terminar.

## Entornos distintos del local

Para Worker local, usá `APP_ORIGIN=http://127.0.0.1:8787` en el entorno que recibe Wrangler y reconstruí con `npm run cf:build`. La lista local admite también el origen de pruebas Next `http://127.0.0.1:3100`.

Antes de habilitarlo en un Supabase remoto, configurar **Reset password** con el contenido de `supabase/templates/recovery.html`, el mínimo de ocho caracteres, SMTP y las URL exactas permitidas. `APP_ORIGIN` debe ser el origen HTTPS real y su URL permitida debe terminar en `/recuperar/confirmar`. La configuración local no modifica automáticamente un proyecto remoto. No se realizó ningún despliegue en esta entrega.
