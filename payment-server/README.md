Math-Minds Payment Demo

Instrucciones rápidas:

1. Copia `.env.example` a `.env` y coloca tu `PRIVATE_KEY` (llave privada de Wompi) y opcionalmente `REDIRECT_URL`.
2. Instala dependencias:

```bash
cd payment-server
npm install
```

3. Ejecuta el servidor:

```bash
npm start
```

4. En el frontend (`finalizar_pago.html`) el flujo llamará a `/api/create-transaction` para obtener `checkout_url` y redirigir al usuario.

Notas:
- En desarrollo si no defines `PRIVATE_KEY` el servidor devolverá un `checkout_url` demo para permitir pruebas locales.
- Implementa verificación de firma en `/api/webhook` según la documentación de Wompi antes de confiar en los eventos.
