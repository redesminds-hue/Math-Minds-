function generarFirmaWompi(amountInCents, reference) {
  const secretKey = PropertiesService
    .getScriptProperties()
    .getProperty('WOMPI_PRIVATE_KEY_TEST');

  if (!secretKey) {
    throw new Error('No existe WOMPI_PRIVATE_KEY_TEST');
  }

  const textToSign = `${reference}${amountInCents}COP`;
  Logger.log('Firmando:', textToSign);

  const signatureBytes = Utilities.computeHmacSha256Signature(
    textToSign,
    secretKey
  );

  const signatureHex = signatureBytes
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');

  return signatureHex;
}

function doGet(e) {
  var output = ContentService.createTextOutput();
  
  try {
    var amount = String(e.parameter.amount || '');
    var reference = String(e.parameter.reference || '');
    
    Logger.log('GET recibido - Amount: ' + amount + ', Reference: ' + reference);
    
    if (!amount || !reference) {
      output.append(JSON.stringify({ error: 'Missing parameters' }));
      return output.setMimeType(ContentService.MimeType.JSON);
    }
    
    var signature = generarFirmaWompi(amount, reference);
    
    output.append(JSON.stringify({
      success: true,
      signature: signature,
      amount: amount,
      reference: reference
    }));
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    output.append(JSON.stringify({ error: error.toString() }));
  }
  
  return output.setMimeType(ContentService.MimeType.JSON);
}

function testFirma() {
  try {
    var firma = generarFirmaWompi('6300000', 'MM-TEST-123');
    Logger.log('✅ Firma:', firma);
  } catch (e) {
    Logger.log('❌ Error:', e.toString());
  }
}