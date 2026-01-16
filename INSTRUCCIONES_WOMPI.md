# 🔧 Configuración de Wompi - Pasos Críticos

## 1. Obtener tu Clave Privada de Wompi

1. Accede a [Wompi Dashboard - Sandbox](https://dashboard-sandbox.wompi.co/)
2. Ve a **Settings** → **API Keys**
3. Copia tu **Private Key** (comienza con algo como `prv_test_...`)

## 2. Configurar Apps Script

1. Ve a [Google Apps Script](https://script.google.com/)
2. Abre tu proyecto de Apps Script (deployment URL)
3. En el editor, ve a **Project Settings** (⚙️)
4. Baja hasta **Script properties**
5. Haz clic en **Add script property** y añade:
   - **Property:** `WOMPI_PRIVATE_KEY_TEST`
   - **Value:** `{TU_CLAVE_PRIVADA}` (la que copiaste en paso 1)

6. Haz clic en **Save**

## 3. Verificar la Firma

1. En Google Apps Script, abre la consola (**Ctrl+Shift+I** en el editor)
2. Copia y ejecuta esta función de prueba:

```javascript
function testFirma() {
  try {
    var firma = generarFirmaWompi('6300000', 'MM-TEST-123', 'COP');
    Logger.log('✅ Firma correcta:', firma);
  } catch (e) {
    Logger.log('❌ Error:', e.toString());
  }
}
```

3. Ejecuta `testFirma()` desde la consola
4. Si ves un error sobre `WOMPI_PRIVATE_KEY_TEST`, vuelve al paso 2

## 4. Probar en tu Sitio

1. Recarga tu página de pagos
2. Completa el formulario
3. Observa la consola del navegador (**F12**)
4. Deberías ver:
   - ✅ Firma obtenida correctamente
   - ✅ Widget de Wompi renderizado
   - El botón de pago debería aparecer

## ❌ Si Aún hay Error 422

Los parámetros enviados a Wompi deben ser exactamente:

```
reference + amountInCents + currency
```

**Ejemplo:**
- Reference: `MM-1234567890-abc123`
- Amount in cents: `6300000` (= $63,000 COP)
- Currency: `COP`

**Texto a firmar:** `MM-1234567890-abc1236300000COP`

Si ves error `undefined` en merchant: asegúrate que tu `data-public-key` sea exactamente:
```
pub_test_B3FDnEk0nvEP7EUFzOEoRPl0N8HKGsgK
```

## 📝 Debug Rápido

Si algo falla, revisa:
1. Console del navegador (F12)
2. Apps Script logs: [script.google.com](https://script.google.com) → Ver logs
3. Verifica que la clave privada esté en Script Properties (sin espacios extras)
