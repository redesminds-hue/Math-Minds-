// Chatbot para Math Minds
(function(){
  // Variable para almacenar la base de datos cuando esté lista
  let bd = [];
  
  // Función para obtener colegios únicos de la base de datos
  function obtenerColegios() {
    if (!bd || bd.length === 0) return [];
    return [...new Set(bd.map(p => p.colegio))].filter(Boolean).sort();
  }
  
  // Función para obtener productos únicos
  function obtenerProductos() {
    if (!bd || bd.length === 0) return [];
    return [...new Set(bd.map(p => p.producto))].filter(Boolean).sort();
  }
  
  // Función para obtener colegios que venden un producto específico
  function obtenerColegiosPorProducto(nombreProducto) {
    if (!bd || bd.length === 0) return [];
    const productosFiltered = bd.filter(p => 
      (p.producto || '').toLowerCase().includes(nombreProducto.toLowerCase())
    );
    return [...new Set(productosFiltered.map(p => p.colegio))].filter(Boolean).sort();
  }
  
  // Función para buscar productos similares
  function buscarProductoSimilar(busqueda) {
    if (!bd || bd.length === 0) return [];
    const productos = obtenerProductos();
    return productos.filter(p => 
      p.toLowerCase().includes(busqueda.toLowerCase())
    );
  }
  
  // Función para formatear lista de colegios
  function formatearLista(items) {
    if (items.length === 0) return "No hay información disponible";
    if (items.length === 1) return items[0];
    return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
  }

  // Función para obtener grados únicos
  function obtenerGrados() {
    if (!bd || bd.length === 0) return [];
    return [...new Set(bd.map(p => p.grado))].filter(Boolean).sort();
  }

  // Función para obtener grados por producto
  function obtenerGradosPorProducto(nombreProducto) {
    if (!bd || bd.length === 0) return [];
    const productosFiltered = bd.filter(p => 
      (p.producto || '').toLowerCase().includes(nombreProducto.toLowerCase())
    );
    return [...new Set(productosFiltered.map(p => p.grado))].filter(Boolean).sort();
  }

  // Función para buscar colegio parcialmente
  function buscarColegioParcial(busqueda) {
    const colegios = obtenerColegios();
    const busquedaLower = busqueda.toLowerCase().trim();
    
    // Búsqueda exacta primero
    let encontrado = colegios.find(c => c.toLowerCase() === busquedaLower);
    if (encontrado) return encontrado;
    
    // Búsqueda parcial (contiene)
    encontrado = colegios.find(c => c.toLowerCase().includes(busquedaLower));
    if (encontrado) return encontrado;
    
    // Búsqueda inversa (el colegio contiene la búsqueda)
    encontrado = colegios.find(c => busquedaLower.includes(c.toLowerCase()));
    if (encontrado) return encontrado;
    
    return null;
  }

  // Respuestas dinámicas del chatbot
  const crearRespuestas = () => ({
    queEsMathMinds: {
      pattern: /qué es|quiénes somos|sobre ustedes|acerca de|quién eres|presentación|info de la empresa/i,
      response: () => {
        return "🎓 **Math Minds** es una empresa educativa especializada en soluciones de aprendizaje de matemáticas.\n\nNuestro objetivo:\n• Mejorar la calidad educativa en matemáticas\n• Ofrecer herramientas tecnológicas innovadoras\n• Proporcionar recursos de calidad a colegios\n\nTrabajamos con plataformas como ALEKS, Reveal Math, Prime y Material Didáctico. ¡Estamos comprometidos con la excelencia educativa! 📚";
      }
    },
    
    saludo: {
      pattern: /hola|hi|buenos días|buenas tardes|buenos días|buenas noches|hoe|hey|qué tal|¿qué hay/i,
      response: () => "¡Hola! 👋 Bienvenido a Math Minds.\n\n¿En qué puedo ayudarte? Algunos temas que puedo atender:\n\n• 🛒 Cómo comprar productos\n• 📚 Información sobre ALEKS, Reveal, Prime\n• 🏫 Colegios con convenio\n• � Métodos de pago\n• 📞 Contacto y horarios\n• 🎓 Beneficios educativos\n\n¡Escribe tu pregunta o di 'menú' para ver más opciones! 😊"
    },
    
    productos: {
      pattern: /productos|qué venden|qué ofrecen|tienda|comprar|catálogo|¿qué tiene/i,
      response: (mensaje) => {
        const productos = obtenerProductos();
        if (productos.length > 0) {
          return `📚 Nuestros productos disponibles son:\n\n${productos.map(p => `• ${p}`).join('\n')}\n\n¿Quieres saber más sobre alguno de estos productos?`;
        }
        return "Ofrecemos productos educativos de matemáticas como ALEKS, Reveal Math, Prime y Material Didáctico. ¿Cuál te interesa?";
      }
    },

    consultaProducto: {
      pattern: /qué (tienen|tiene|hay|ofrecen|venden) (de|sobre|en) (aleks|reveal|prime|material)/i,
      response: (mensaje) => {
        const productos = obtenerProductos();
        let productoEncontrado = null;
        
        // Buscar qué producto se menciona
        for (let producto of productos) {
          if (mensaje.toLowerCase().includes(producto.toLowerCase())) {
            productoEncontrado = producto;
            break;
          }
        }
        
        if (!productoEncontrado) {
          // Búsqueda parcial
          const palabras = mensaje.toLowerCase().split(/\s+/);
          for (let palabra of palabras) {
            if (palabra.length > 3) {
              productoEncontrado = productos.find(p => p.toLowerCase().includes(palabra));
              if (productoEncontrado) break;
            }
          }
        }
        
        if (productoEncontrado) {
          const colegios = obtenerColegiosPorProducto(productoEncontrado);
          const grados = obtenerGradosPorProducto(productoEncontrado);
          
          let respuesta = `📚 **${productoEncontrado}**\n\n`;
          
          if (colegios.length > 0) {
            respuesta += `📍 **Disponible en colegios:**\n${colegios.map(c => `• ${c}`).join('\n')}\n\n`;
          }
          
          if (grados.length > 0) {
            respuesta += `📖 **Grados:** ${grados.join(', ')}\n\n`;
          }
          
          respuesta += `¿Quieres más información o deseas comprarlo?`;
          return respuesta;
        }
        
        const productosStr = productos.slice(0, 4).join(', ');
        return `¿Qué producto te interesa? Tenemos: ${productosStr}`;
      }
    },
    
    aleks: {
      pattern: /\baleks\b/i,
      response: (mensaje) => {
        const colegios = obtenerColegiosPorProducto('ALEKS');
        const grados = obtenerGradosPorProducto('ALEKS');
        let respuesta = "🤖 **ALEKS** es una plataforma de aprendizaje adaptativo que utiliza inteligencia artificial para personalizar el currículo.\n\nCaracterísticas:\n• Instrucción paso a paso\n• Práctica ilimitada\n• Evaluaciones precisas\n• IA personalizada para cada estudiante";
        
        if (colegios.length > 0) {
          respuesta += `\n\n📍 Disponible en: ${formatearLista(colegios)}`;
        }
        if (grados.length > 0) {
          respuesta += `\n📖 Para grados: ${grados.join(', ')}`;
        }
        
        return respuesta;
      }
    },
    
    reveal: {
      pattern: /reveal|reveal math/i,
      response: (mensaje) => {
        const colegios = obtenerColegiosPorProducto('Reveal');
        const grados = obtenerGradosPorProducto('Reveal');
        let respuesta = "📖 **Reveal Math** es un programa interactivo que combina enseñanza basada en investigación con tecnología digital.\n\nIncluye:\n• Lecciones en video interactivas\n• Actividades prácticas\n• Evaluaciones continuas\n• Desde kindergarten hasta secundaria";
        
        if (colegios.length > 0) {
          respuesta += `\n\n📍 Disponible en: ${formatearLista(colegios)}`;
        }
        if (grados.length > 0) {
          respuesta += `\n📖 Para grados: ${grados.join(', ')}`;
        }
        
        return respuesta;
      }
    },
    
    prime: {
      pattern: /\bprime\b/i,
      response: (mensaje) => {
        const colegios = obtenerColegiosPorProducto('Prime');
        const grados = obtenerGradosPorProducto('Prime');
        let respuesta = "📕 **Prime** es una serie de libros de matemáticas para secundaria diseñada con rigor académico.\n\nOfrece:\n• Enfoque integral y riguroso\n• Ejercicios prácticos y variados\n• Aplicaciones reales de conceptos\n• Desarrollo de pensamiento crítico";
        
        if (colegios.length > 0) {
          respuesta += `\n\n📍 Disponible en: ${formatearLista(colegios)}`;
        }
        if (grados.length > 0) {
          respuesta += `\n📖 Para grados: ${grados.join(', ')}`;
        }
        
        return respuesta;
      }
    },
    
    material: {
      pattern: /material didáctico|material concreto|didáctico/i,
      response: (mensaje) => {
        const colegios = obtenerColegiosPorProducto('Material');
        const grados = obtenerGradosPorProducto('Material');
        let respuesta = "🧮 **Material Didáctico** incluye recursos físicos y manipulativos para facilitar el aprendizaje práctico.\n\nIncluye:\n• Bloques y figuras geométricas\n• Juegos matemáticos interactivos\n• Herramientas manipulativas\n• Experiencia hands-on para conceptos abstractos";
        
        if (colegios.length > 0) {
          respuesta += `\n\n📍 Disponible en: ${formatearLista(colegios)}`;
        }
        if (grados.length > 0) {
          respuesta += `\n📖 Para grados: ${grados.join(', ')}`;
        }
        
        return respuesta;
      }
    },
    
    colegios: {
      pattern: /colegios|dónde|en qué colegios|convenios|tenemos convenio|instituciones/i,
      response: () => {
        const colegios = obtenerColegios();
        if (colegios.length > 0) {
          return `🏫 **Colegios con Convenio Math Minds:**\n\n${colegios.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n¿Quieres saber qué productos tenemos en un colegio específico?`;
        }
        return "Tenemos convenios con varios colegios principales de la ciudad. ¿Cuál es tu colegio?";
      }
    },
    
    productoPorColegio: {
      pattern: /qué productos.*hay|qué venden en|en .+ hay|tiene .+ en|del colegio|de .+ colegio|en mi colegio/i,
      response: (mensaje) => {
        // Intentar extraer el nombre del colegio del mensaje
        const colegios = obtenerColegios();
        
        // Extraer posibles nombres de colegios del mensaje
        let colegioEncontrado = null;
        for (let colegio of colegios) {
          if (mensaje.toLowerCase().includes(colegio.toLowerCase())) {
            colegioEncontrado = colegio;
            break;
          }
        }
        
        // Si no encuentra exacto, intentar búsqueda más flexible
        if (!colegioEncontrado) {
          // Extraer palabras clave del mensaje
          const palabras = mensaje.toLowerCase().split(/\s+/);
          for (let palabra of palabras) {
            if (palabra.length > 3) {
              colegioEncontrado = buscarColegioParcial(palabra);
              if (colegioEncontrado) break;
            }
          }
        }
        
        if (colegioEncontrado) {
          const productos = [...new Set(bd
            .filter(p => p.colegio === colegioEncontrado)
            .map(p => p.producto)
          )].filter(Boolean).sort();
          
          if (productos.length > 0) {
            return `📚 En **${colegioEncontrado}** disponemos de:\n\n${productos.map(p => `• ${p}`).join('\n')}\n\n¿Quieres conocer más sobre alguno?`;
          }
          return `No hay información de productos en ${colegioEncontrado} en este momento.`;
        }
        
        return `Para saber qué productos tenemos en tu colegio, menciona su nombre. Nuestros colegios son: ${formatearLista(colegios)}`;
      }
    },
    
    colegiosPorProducto: {
      pattern: /en qué colegios|dónde venden|dónde consigo|disponible.*donde|venta de|venden .+/i,
      response: (mensaje) => {
        // Intentar extraer el producto del mensaje
        const productos = obtenerProductos();
        let productoEncontrado = null;
        
        // Búsqueda exacta
        for (let producto of productos) {
          if (mensaje.toLowerCase().includes(producto.toLowerCase())) {
            productoEncontrado = producto;
            break;
          }
        }
        
        // Si no encuentra, intentar búsqueda parcial
        if (!productoEncontrado) {
          const palabras = mensaje.toLowerCase().split(/\s+/);
          for (let palabra of palabras) {
            if (palabra.length > 3) {
              productoEncontrado = productos.find(p => p.toLowerCase().includes(palabra));
              if (productoEncontrado) break;
            }
          }
        }
        
        if (productoEncontrado) {
          const colegios = obtenerColegiosPorProducto(productoEncontrado);
          if (colegios.length > 0) {
            return `📍 **${productoEncontrado}** está disponible en:\n\n${colegios.map(c => `• ${c}`).join('\n')}\n\n¿Necesitas más información sobre este producto?`;
          }
          return `No tenemos información sobre ${productoEncontrado} en nuestros colegios en este momento.`;
        }
        
        // Si no encontró producto específico, pedir que mencione cuál
        const productosStr = productos.slice(0, 5).join(', ');
        return `¿Sobre cuál producto quieres saber dónde está disponible? Tenemos: ${productosStr}...`;
      }
    },
    
    pago: {
      pattern: /pago|pagar|formas de pago|tarjeta|cómo pagar|método|transferencia|efectivo|bancario|nequi|daviplata|precio|costo|cuánto|cuánto cuesta/i,
      response: () => "💳 **MÉTODOS DE PAGO DISPONIBLES:**\n\n✅ Tarjeta de crédito/débito\n✅ Transferencia bancaria\n✅ Nequi/Daviplata\n✅ Efectivo (coordinando directamente)\n\n**Para información y cotizaciones:**\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\nNuestro equipo te dará los mejores precios según tu necesidad. 😊"
    },
    
    contacto: {
      pattern: /contacto|contactar|teléfono|whatsapp|email|correo|mail|llamar/i,
      response: () => "📞 **Contacta con Math Minds:**\n\n📱 WhatsApp: +57 301 345 6259\n☎️ Teléfono: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\n**Síguenos en:**\n📘 Facebook: @mathmindseducation\n📷 Instagram: @mathmindseducation\n\n¿Hay algo más en lo que pueda ayudarte?"
    },
    
    horarios: {
      pattern: /horario|atención|cuándo|disponible|abierto/i,
      response: () => "🕐 Estamos disponibles durante horario laboral.\n\nPara consultas urgentes, contáctanos por:\n📱 WhatsApp: +57 301 345 6259 (disponible las 24/7)\n📧 Email: mathmindscol@gmail.com\n\n¿Necesitas otra información?"
    },
    
    tienda: {
      pattern: /tienda|compra en línea|comprar online|plataforma|web|sitio|store|ecommerce/i,
      response: () => "🛒 **NUESTRA TIENDA EN LÍNEA:**\n\nEn la sección **TIENDA** de nuestro sitio web puedes:\n\n✅ Ver catálogo completo de productos\n✅ Filtrar por colegio y grado\n✅ Ver información detallada de cada producto\n✅ Agregar al carrito\n✅ Proceder al pago seguro\n\n**Ventajas:**\n• Proceso rápido y seguro\n• Múltiples formas de pago\n• Confirmación inmediata\n• Seguimiento de tu pedido\n\n¿Necesitas ayuda para encontrar algo específico?"
    },
    
    grados: {
      pattern: /grado|curso|nivel|año|6to|7mo|8vo|9no|10mo|11ro|primaria|secundaria|básica|para niños|para estudiantes/i,
      response: () => {
        const grados = obtenerGrados();
        let respuesta = "📚 **GRADOS QUE ATENDEMOS:**\n\n";
        
        if (grados.length > 0) {
          respuesta += `${grados.map(g => `✅ ${g}`).join('\n')}\n\n`;
        } else {
          respuesta += `✅ Primaria (grados 1-5)\n✅ Secundaria (grados 6-11)\n\n`;
        }
        
        respuesta += `**Disponibilidad por grado:**\nCada producto está disponible en diferentes grados según tu colegio. Algunos como ALEKS y Reveal cubren desde primaria, mientras que Prime es más para secundaria.\n\n**¿Cuál es tu grado?**\nCuéntame el grado y el colegio para recomendarte el mejor producto. 📖`;
        
        return respuesta;
      }
    },
    
    beneficios: {
      pattern: /beneficio|ventaja|por qué|utilidad|para qué|mejora|por qué comprar|razones|importancia/i,
      response: () => "✨ **BENEFICIOS DE USAR MATH MINDS:**\n\n📈 Mejora significativa del rendimiento académico\n🎯 Aprendizaje personalizado y adaptativo con IA\n💡 Desarrollo del pensamiento crítico y lógico\n🤖 Tecnología educativa de última generación\n👥 Recursos validados internacionalmente\n📊 Seguimiento detallado del progreso\n🎓 Metodologías probadas y efectivas\n⏰ Flexibilidad para aprender a tu ritmo\n🌟 Motivación y engagement del estudiante\n🏆 Mejores resultados en evaluaciones\n\n**¿Quieres probar uno de nuestros productos?** 😊"
    },

    recomendacion: {
      pattern: /recomendación|recomienda|qué me recomiendas|cuál es mejor|cuál debería|qué conviene|qué es lo mejor|producto ideal/i,
      response: () => "🎯 **¿CUÁL PRODUCTO TE RECOMENDAMOS?**\n\nDepende de tus necesidades:\n\n**Para aprendizaje adaptativo e IA:**\n→ **ALEKS** (Primaria y Secundaria)\n\n**Para clases interactivas con videos:**\n→ **Reveal Math** (Primaria y Secundaria)\n\n**Para un texto completo y riguroso:**\n→ **Prime** (Secundaria)\n\n**Para aprender manipulando:**\n→ **Material Didáctico** (Primaria)\n\n**¿Cuál es tu grado y colegio?** Te haré una recomendación personalizada. 😊"
    },

    disponibilidad: {
      pattern: /disponible|hay stock|en existencia|tienes|cuándo|cuándo disponible|despacho|rápido/i,
      response: () => "📦 **DISPONIBILIDAD Y DESPACHO:**\n\nNuestros productos digitales están disponibles inmediatamente después de la compra.\n\nPara información específica sobre:\n• Disponibilidad en tu colegio\n• Tiempos de envío\n• Stock de material físico\n\nContactanos:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\n¿Qué producto te interesa? 🛒"
    },

    oferta: {
      pattern: /oferta|descuento|promoción|rebaja|liquidación|venta|especial|ahorro|precio especial/i,
      response: () => "🎉 **PROMOCIONES Y OFERTAS:**\n\nTenemos opciones especiales según:\n• Cantidad de usuarios\n• Duración del contrato\n• Paquetes combinados\n• Convenios institucionales\n\n**Para consultar ofertas actuales:**\n📱 WhatsApp: +57 301 345 6259 (¡Contáctanos!)\n📧 Email: mathmindscol@gmail.com\n\nPodríamos tener la promoción perfecta para ti. ¡Escribenos! 💝"
    },

    duda: {
      pattern: /duda|no entiendo|no entiende|confundido|aclarar|explicar mejor|más claro|no sé|unclear|confuso/i,
      response: () => "🤔 ¡No te preocupes, estoy para aclarar!\n\nPuedo ayudarte con:\n• Explicar diferencias entre productos\n• Cómo funcionan las plataformas\n• Proceso de compra paso a paso\n• Precios y opciones de pago\n• Cualquier duda sobre Math Minds\n\n¿Cuál es tu pregunta específica? Haré mi mejor esfuerzo por explicar. 😊"
    },

    prueba: {
      pattern: /prueba|demo|demostración|ver|probar|gratuito|gratis|muestra|trial/i,
      response: () => "🧪 **¿QUIERES PROBAR NUESTROS PRODUCTOS?**\n\nPara solicitar una demostración o prueba gratuita:\n\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\nNuestro equipo te mostrará:\n✅ Cómo funciona cada plataforma\n✅ Ejemplos de uso real\n✅ Resultados que pueden lograr\n✅ Opciones personalizadas\n\n¡Estamos listos para ti! 🚀"
    },
    
    pago: {
      pattern: /pago|pagar|formas de pago|tarjeta|cómo pagar|método|transferencia|efectivo|bancario|nequi|daviplata/i,
      response: () => "💳 **MÉTODOS DE PAGO DISPONIBLES:**\n\n✅ Tarjeta de crédito/débito\n✅ Transferencia bancaria\n✅ Nequi/Daviplata\n✅ Efectivo (coordinando directamente)\n\n**Para cotizaciones personalizadas:**\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\n¿Necesitas información sobre un producto específico?"
    },
    
    envio: {
      pattern: /envío|enviar|entrega|costo de envío|domicilio|despacho/i,
      response: () => "📦 Para información sobre envíos y entregas:\n\n📱 Contactanos por WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\nNos encargaremos de que recibas tu pedido en perfecto estado.\n\n¿Necesitas más detalles?"
    },
    
    devoluciones: {
      pattern: /devolución|cambio|reembolso|garantía|defecto/i,
      response: () => "🔄 **Política de devoluciones y cambios:**\n\nPara consultas sobre devoluciones o cambios:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n📞 Teléfono: +57 301 345 6259\n\nEstaremos encantados de ayudarte a resolver cualquier inconveniente.\n\n¿Hay algo específico que necesites?"
    },
    
    comoComprar: {
      pattern: /cómo compro|cómo comprar|quiero comprar|proceso de compra|pasos para comprar|cómo realizo|forma de compra|modalidad de compra|procedimiento|compra en línea|compra online|realizar una compra|efectuar compra|hacer una compra/i,
      response: () => "🛒 **¿Cómo comprar en Math Minds?**\n\n**Opción 1: En línea (Recomendado)**\n1. Visita nuestra sección **TIENDA**\n2. Explora los productos disponibles\n3. Selecciona el producto y cantidad\n4. Agrégalo al carrito\n5. Completa tu información\n6. Elige método de pago\n7. ¡Listo! Recibirás confirmación\n\n**Opción 2: Contacto directo**\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\n¿Necesitas ayuda con algún producto específico?"
    },

    compra: {
      pattern: /quiero comprar|deseo comprar|quisiera comprar|puedo comprar|vender|vendo/i,
      response: () => "¡Perfecto! 🎉\n\n**¿Qué te gustaría comprar?**\n\nPuedes:\n• Explorar la **TIENDA** en nuestro sitio\n• Preguntarme sobre un producto específico\n• Decirme tu colegio para recomendaciones\n• Conocer precios y disponibilidad\n\n¿Cuál es el producto que te interesa?"
    },

    ayuda: {
      pattern: /ayuda|help|qué puedo hacer|opciones|menú|comandos|palabras clave|preguntas frecuentes|faq/i,
      response: () => "🆘 **¡Aquí está todo lo que puedo ayudarte!**\n\n📚 **PRODUCTOS:**\n• ¿Qué productos tienen?\n• Cuéntame sobre ALEKS\n• ¿Qué es Reveal Math?\n• Información de Prime\n• Material didáctico\n\n🏫 **COLEGIOS:**\n• ¿En qué colegios tienen?\n• ¿Qué hay en [colegio]?\n• ¿Dónde venden [producto]?\n\n🛒 **COMPRAS:**\n• ¿Cómo compro?\n• Quiero comprar un producto\n• ¿Cuál es el costo?\n• Formas de pago\n\n📞 **CONTACTO:**\n• ¿Cuál es tu teléfono?\n• ¿Tienen WhatsApp?\n• Email de contacto\n• Horarios de atención\n\n📦 **OTROS:**\n• ¿Cuáles son los beneficios?\n• ¿Qué grados atienden?\n• ¿Cómo es el envío?\n• Devoluciones\n\n¡Escribe tu pregunta! 😊"
    },

    menu: {
      pattern: /mostrar menú|ver menú|opciones|qué puedo preguntar|¿qué preguntas|ejemplos de preguntas/i,
      response: () => "📋 **PREGUNTAS FRECUENTES:**\n\n**SOBRE PRODUCTOS:**\n• Productos disponibles\n• ¿Qué es ALEKS?\n• ¿Cuál es el mejor para primaria?\n• ¿Tienen material para grado 10?\n\n**SOBRE UBICACIÓN:**\n• Colegios con convenio\n• ¿Venden en Colegio X?\n• ¿Dónde consigo ALEKS?\n\n**SOBRE PRECIOS Y COMPRA:**\n• ¿Cuánto cuesta?\n• Cómo compro\n• Métodos de pago\n\n**SOBRE INFORMACIÓN:**\n• ¿Qué es Math Minds?\n• Beneficios de usar nuestros productos\n• ¿Tienen envío a domicilio?\n\n¡Puedes escribir cualquiera de estas preguntas! 🎓"
    },
    
    gracias: {
      pattern: /gracias|thank you|thanks|muchas gracias|de verdad|buena onda|agradecer/i,
      response: () => "¡De nada! 😊 Estamos aquí para ayudarte en todo lo que necesites. Si tienes más preguntas sobre Math Minds, nuestros productos o servicios, no dudes en escribir. ¡Que tengas un excelente día!"
    },

    inscripcion: {
      pattern: /inscribir|inscripción|registrar|registro|registrarse|crear cuenta|cuenta nueva|afiliación/i,
      response: () => "📝 **INSCRIPCIÓN Y REGISTRO:**\n\nPara inscribirse o registrar a los estudiantes:\n\n✅ A través de la **TIENDA** en línea\n✅ Contactando directamente con nuestro equipo\n\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\nNuestro equipo te guiará en todo el proceso de inscripción. ¡Es muy sencillo! 😊"
    },

    acceso: {
      pattern: /acceso|ingresar|login|usuario|contraseña|password|olvidé|no puedo entrar|no me deja/i,
      response: () => "🔐 **ACCESO Y USUARIOS:**\n\nSi tienes problemas con:\n• Contraseña olvidada\n• No puedes acceder\n• Datos de usuario\n• Cuenta bloqueada\n\n📱 Contactanos inmediatamente:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\nNuestra asistencia técnica está disponible para ayudarte. ⚡"
    },

    soporte: {
      pattern: /soporte técnico|ayuda técnica|problema|error|no funciona|bug|fallo|no carga/i,
      response: () => "🛠️ **SOPORTE TÉCNICO:**\n\nSi experimentas problemas técnicos:\n\n1️⃣ Intenta recargar la página\n2️⃣ Limpia el caché de tu navegador\n3️⃣ Intenta con otro navegador\n4️⃣ Revisa tu conexión a internet\n\nSi persiste el problema:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\nDescribe tu problema y te ayudaremos rápidamente. 🚀"
    },

    capacitacion: {
      pattern: /capacitación|entrenamiento|formación|cómo usar|tutorial|guía|asesoría|workshops|talleres/i,
      response: () => "🎓 **CAPACITACIÓN Y FORMACIÓN:**\n\nOrecemos:\n✅ Capacitación para docentes\n✅ Talleres de implementación\n✅ Tutoriales y videos\n✅ Guías paso a paso\n✅ Asesoría personalizada\n\n📱 Para programar:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\nNuestro equipo está disponible para entrenar a tu institución. 🌟"
    },

   


    familia: {
      pattern: /padres|familias|papá|mamá|mamás|padres de familia|para la familia|en casa|home/i,
      response: () => "👨‍👩‍👧‍👦 **SOLUCIONES PARA FAMILIAS:**\n\nNuestros productos son perfectos para:\n• Refuerzo en casa\n• Aprendizaje después de clases\n• Seguimiento del progreso\n• Apoyo académico familiar\n\n**Beneficios:**\n✅ Acceso flexible\n✅ Seguimiento de progreso en tiempo real\n✅ Reportes para padres\n✅ Precios accesibles\n\n📱 Consulta nuestras opciones:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\n¡El aprendizaje en familia es más efectivo! ❤️"
    },

    internacional: {
      pattern: /internacional|exterior|otros países|global|fuera de colombia|envío al extranjero|aceptan en otro país/i,
      response: () => "🌍 **ALCANCE INTERNACIONAL:**\n\n¿Eres de otro país? ¡Excelente!\n\nPara información sobre:\n• Disponibilidad en tu país\n• Costos de envío internacional\n• Formas de pago\n• Soporte en tu idioma\n\n📱 Contacta con nuestro equipo:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\nTrabajamos con instituciones en toda Latinoamérica. 🌟"
    },

    certificacion: {
      pattern: /certificado|certificación|diploma|credencial|validación académica/i,
      response: () => "🏆 **CERTIFICADOS Y VALIDACIÓN:**\n\nAlgunos de nuestros productos incluyen:\n✅ Certificados de completitud\n✅ Validación académica\n✅ Reportes de progreso\n✅ Constancias de aprendizaje\n\nPara más detalles sobre certificaciones:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\n¡Valida el aprendizaje de tus estudiantes! 📜"
    },

    comparacion: {
      pattern: /comparar|diferencia|mejor|vs|versus|cual es mejor|cuál conviene|diferencia entre/i,
      response: () => "⚖️ **COMPARATIVA DE PRODUCTOS:**\n\n**ALEKS**: Mejor para IA adaptativa\n**Reveal Math**: Mejor para clases interactivas\n**Prime**: Mejor para texto riguroso\n**Material Didáctico**: Mejor para aprender manipulando\n\n¿Quieres una comparación detallada? 📊\n\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\nTe ayudaremos a elegir el ideal para ti. 😊"
    },

    trial: {
      pattern: /período de prueba|trial|prueba gratis|versión gratis|muestra|test drive|sin compromiso|30 días/i,
      response: () => "🎯 **PERÍODO DE PRUEBA:**\n\n¿Quieres probar sin compromiso?\n\nDisponemos de:\n✅ Pruebas gratuitas\n✅ Períodos de demostración\n✅ Acceso limitado sin pago\n✅ Garantía de satisfacción\n\n📱 Solicita tu prueba:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n☎️ Teléfono: +57 301 345 6259\n\n¡Prueba antes de comprar! ✨"
    },

    historial: {
      pattern: /historial|reporte|progreso|calificaciones|notas|desempeño|rendimiento|analytics/i,
      response: () => "📊 **REPORTES Y SEGUIMIENTO:**\n\nNuestros productos ofrecen:\n✅ Reportes detallados de progreso\n✅ Seguimiento de desempeño\n✅ Análisis de fortalezas/debilidades\n✅ Historial de actividades\n✅ Exportación de datos\n\n**¿Cómo acceder?**\nDespués de tu compra tendrás acceso a:\n• Panel de control personalizado\n• Gráficos de progreso\n• Exportar reportes\n\n¿Necesitas ayuda para interpretar los datos? 📈"
    },

    especialidades: {
      pattern: /álgebra|geometría|cálculo|estadística|trigonometría|fracciones|ecuaciones|derivadas|integrales/i,
      response: () => "🧮 **TEMAS ESPECIALIZADOS:**\n\nNuestros productos cubren:\n✅ Aritmética y operaciones\n✅ Álgebra\n✅ Geometría\n✅ Estadística y probabilidad\n✅ Cálculo (en niveles avanzados)\n✅ Y mucho más...\n\nCada producto tiene enfoque en diferentes temas según el grado.\n\n¿Necesitas un producto específico para un tema?\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\n¡Encontramos la solución perfecta! 🎯"
    },

    idioma: {
      pattern: /idioma|spanish|english|portugués|traducción|disponible en|otro idioma|language/i,
      response: () => "🌐 **IDIOMAS DISPONIBLES:**\n\nNuestros productos están principalmente en:\n✅ Español\n✅ Inglés\n\nAlgunos recursos también en:\n✅ Portugués\n\nPara información sobre disponibilidad en otros idiomas:\n📱 WhatsApp: +57 301 345 6259\n📧 Email: mathmindscol@gmail.com\n\nPodemos ayudarte a encontrar la mejor opción. 🗣️"
    },

    default: {
      response: (mensaje) => {
        const palabrasClave = obtenerProductos().concat(obtenerColegios()).slice(0, 3);
        return `No estoy completamente seguro sobre eso, pero te puedo ayudar con:\n\n🛒 **COMPRAS:**\n• Cómo compro\n• Quiero comprar [producto]\n• Métodos de pago\n\n📚 **PRODUCTOS:**\n• ¿Qué productos venden?\n• Cuéntame de ALEKS\n• ¿Tienen para primaria?\n\n🏫 **COLEGIOS:**\n• Colegios con convenio\n• ¿Venden en mi colegio?\n• ¿Dónde consigo [producto]?\n\n📞 **CONTACTO:**\n• WhatsApp\n• Teléfono\n• Email\n\n💡 **Tip:** Escribe "menú" para ver todas las preguntas que puedo responder.\n\n¿En qué puedo ayudarte? 😊`;
      }
    }
  });

  // Crear elementos del chatbot
  function crearChatbot() {
    // Contenedor principal
    const chatContainer = document.createElement('div');
    chatContainer.id = 'mm-chatbot-container';
    chatContainer.innerHTML = `
      <div id="mm-chat-widget" class="mm-chat-hidden">
        <div class="mm-chat-header">
          <div class="mm-chat-header-content">
            <h3>Math Minds Chat</h3>
            <span class="mm-chat-status">En línea</span>
          </div>
          <button id="mm-chat-close" class="mm-chat-close-btn" aria-label="Cerrar chat">×</button>
        </div>
        <div id="mm-messages" class="mm-chat-messages"></div>
        <div class="mm-chat-input-area">
          <input 
            type="text" 
            id="mm-chat-input" 
            placeholder="Escribe tu pregunta..." 
            aria-label="Mensaje"
          />
          <button id="mm-chat-send" class="mm-chat-send-btn" aria-label="Enviar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 10L18 2L10 18L8 11L2 10Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
      <button id="mm-chat-toggle" class="mm-chat-toggle-btn" aria-label="Abrir chat">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="mm-chat-badge" style="display:none;">1</span>
      </button>
    `;
    
    document.body.appendChild(chatContainer);
    
    // Referencias a elementos
    const toggle = document.getElementById('mm-chat-toggle');
    const closeBtn = document.getElementById('mm-chat-close');
    const widget = document.getElementById('mm-chat-widget');
    const input = document.getElementById('mm-chat-input');
    const sendBtn = document.getElementById('mm-chat-send');
    const messagesContainer = document.getElementById('mm-messages');
    
    // Eventos
    toggle.addEventListener('click', () => {
      widget.classList.toggle('mm-chat-hidden');
      if (!widget.classList.contains('mm-chat-hidden')) {
        input.focus();
        document.querySelector('.mm-chat-badge').style.display = 'none';
      }
    });
    
    closeBtn.addEventListener('click', () => {
      widget.classList.add('mm-chat-hidden');
    });
    
    sendBtn.addEventListener('click', enviarMensaje);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') enviarMensaje();
    });
    
    // Función para enviar mensaje
    function enviarMensaje() {
      const mensaje = input.value.trim();
      if (!mensaje) return;
      
      // Mostrar mensaje del usuario
      agregarMensaje(mensaje, 'usuario');
      input.value = '';
      
      // Simular respuesta del bot
      setTimeout(() => {
        const respuesta = obtenerRespuesta(mensaje);
        agregarMensaje(respuesta, 'bot');
      }, 500);
    }
    
    // Función para agregar mensaje
    function agregarMensaje(texto, tipo) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `mm-mensaje mm-mensaje-${tipo}`;
      msgDiv.innerHTML = tipo === 'bot' ? convertirMarkdownSimple(texto) : escapeHtml(texto);
      messagesContainer.appendChild(msgDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Función para convertir markdown simple a HTML
    function convertirMarkdownSimple(texto) {
      return texto
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    }
    
    // Función para escapar HTML
    function escapeHtml(texto) {
      const div = document.createElement('div');
      div.textContent = texto;
      return div.innerHTML;
    }
    
    // Función para obtener respuesta
    function obtenerRespuesta(mensaje) {
      const respuestas = crearRespuestas();
      
      for (const key in respuestas) {
        const item = respuestas[key];
        if (item.pattern && item.pattern.test(mensaje)) {
          if (typeof item.response === 'function') {
            return item.response(mensaje);
          }
          return item.response;
        }
      }
      
      if (typeof respuestas.default.response === 'function') {
        return respuestas.default.response(mensaje);
      }
      return respuestas.default.response;
    }
    
    // Mensaje inicial
    setTimeout(() => {
      agregarMensaje("¡Hola! 👋 Bienvenido a **Math Minds**.\n\n¿En qué puedo ayudarte hoy?\n\n✅ Cómo comprar\n✅ Información de productos\n✅ Colegios con convenio\n✅ Precios\n✅ Contacto directo\n\nEscribe tu pregunta o di **'menú'** para ver todas las opciones. 😊", 'bot');
    }, 500);
  }
  
  // Esperar a que la base de datos esté disponible
  function esperarBaseDatos() {
    // Crear chatbot inmediatamente
    crearChatbot();
    
    // Escuchar el evento cuando la base de datos esté lista
    window.addEventListener('baseDeDatosReady', () => {
      bd = window.baseDeDatos || [];
    });
    
    // También revisar si ya está disponible
    setTimeout(() => {
      if (window.baseDeDatos && window.baseDeDatos.length > 0) {
        bd = window.baseDeDatos;
      }
    }, 500);
  }
  
  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', esperarBaseDatos);
  } else {
    esperarBaseDatos();
  }
})();
