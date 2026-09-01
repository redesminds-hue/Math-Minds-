/**
 * GESTOR DE RECURSOS GOOGLE DRIVE (Vanilla JS)
 * GoogleDriveManager.js
 * MATH MINDS
 */
class GoogleDriveManager {
  constructor(options = {}) {
    this.breadcrumbsEl = document.getElementById(options.breadcrumbsId || 'drive-breadcrumbs');
    this.contentEl = document.getElementById(options.contentId || 'drive-content');
    this.searchEl = document.getElementById(options.searchInputId || 'buscadorFichas');
    this.endpoint = options.endpoint || 'obtener_fichas.php';
    this.rol = options.rol || 'estudiante';
    this.usuarioId = options.usuarioId || 0;
    this.onOpenFile = options.onOpenFile || null;

    // Pila de navegación de la ruta actual: [{ id: 0, nombre: 'Inicio' }]
    this.ruta = [
      { id: 0, nombre: options.rootName || 'Inicio' }
    ];

    this.carpetasActuales = [];
    this.archivosActuales = [];

    this.iconos = {
      carpeta: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
      archivo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
      descarga: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`
    };

    // Vincular buscador en vivo si existe
    if (this.searchEl) {
      this.searchEl.addEventListener('input', () => {
        this.filtrarPorTexto(this.searchEl.value.trim());
      });
    }
  }

  // Inicializar cargando el directorio raíz
  init() {
    this.cargarContenido(0);
  }

  // Actualizar credenciales de usuario
  setUsuario(usuarioId, rol = 'estudiante') {
    this.usuarioId = usuarioId;
    this.rol = rol;
  }

  // 1. Cargar Contenido desde el Backend PHP
  async cargarContenido(carpetaId = 0) {
    this.mostrarCargando();
    if (this.searchEl) this.searchEl.value = '';

    try {
      const url = `${this.endpoint}?carpeta_id=${carpetaId}&usuario_id=${this.usuarioId}&rol=${this.rol}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        this.mostrarError(data.mensaje || 'Error al obtener los recursos.');
        return;
      }

      this.carpetasActuales = data.carpetas || [];
      this.archivosActuales = data.archivos || [];

      this.renderizarBreadcrumbs();
      this.renderizarContenido(this.carpetasActuales, this.archivosActuales);

    } catch (error) {
      console.error('Error al cargar contenido:', error);
      this.mostrarError('No se pudo conectar con el servidor.');
    }
  }

  // 2. Renderizar Migas de Pan (Breadcrumbs)
  renderizarBreadcrumbs() {
    if (!this.breadcrumbsEl) return;
    this.breadcrumbsEl.innerHTML = '';

    this.ruta.forEach((item, index) => {
      const esUltimo = index === this.ruta.length - 1;

      const node = document.createElement('button');
      node.type = 'button';
      node.className = `drive-breadcrumb-node ${esUltimo ? 'active' : ''}`;
      node.textContent = (index === 0 ? '📁 ' : '') + this.formatearTexto(item.nombre);

      if (!esUltimo) {
        node.addEventListener('click', () => {
          this.navegarANivel(index);
        });
      }

      this.breadcrumbsEl.appendChild(node);

      if (!esUltimo) {
        const sep = document.createElement('span');
        sep.className = 'drive-breadcrumb-sep';
        sep.textContent = '>';
        this.breadcrumbsEl.appendChild(sep);
      }
    });
  }

  // Regresar a un nivel anterior en la ruta
  navegarANivel(indice) {
    this.ruta = this.ruta.slice(0, indice + 1);
    const destino = this.ruta[this.ruta.length - 1];
    this.cargarContenido(destino.id);
  }

  // Abrir subcarpeta
  abrirCarpeta(carpetaId, nombre) {
    this.ruta.push({ id: carpetaId, nombre: nombre });
    this.cargarContenido(carpetaId);
  }

  // Abrir archivo en visor
  abrirArchivo(archivo) {
    if (typeof this.onOpenFile === 'function') {
      this.onOpenFile(archivo);
      return;
    }
    window.open(`ver_archivo.php?id=${archivo.id}`, '_blank');
  }

  // Filtrar carpetas y archivos en tiempo real
  filtrarPorTexto(query) {
    if (!query) {
      this.renderizarContenido(this.carpetasActuales, this.archivosActuales);
      return;
    }

    const q = query.toLowerCase();
    const carpetasFiltradas = this.carpetasActuales.filter(c => (c.nombre || '').toLowerCase().includes(q));
    const archivosFiltrados = this.archivosActuales.filter(a => (a.titulo || '').toLowerCase().includes(q));

    this.renderizarContenido(carpetasFiltradas, archivosFiltrados, true);
  }

  // 3. Renderizar Contenido en Cuadrícula (CSS Grid)
  renderizarContenido(carpetas, archivos, esBusqueda = false) {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = '';

    const total = carpetas.length + archivos.length;

    if (total === 0) {
      this.contentEl.innerHTML = `
        <div class="drive-status-state">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>
          <p style="font-weight:600;">${esBusqueda ? 'No se encontraron resultados para la búsqueda' : 'Esta carpeta no contiene elementos'}</p>
        </div>
      `;
      return;
    }

    // Nombre limpio de la carpeta padre para badges/metadatos
    const carpetaPadreNombre = this.ruta.length > 1
      ? this.formatearTexto(this.ruta[this.ruta.length - 1].nombre)
      : 'General';

    // --- SECCIÓN 1: CARPETAS ---
    if (carpetas.length > 0) {
      const seccionCarpetas = document.createElement('div');
      seccionCarpetas.className = 'drive-section-group';

      if (archivos.length > 0 || this.ruta.length > 1) {
        const titleCarpetas = document.createElement('div');
        titleCarpetas.className = 'drive-section-title';
        titleCarpetas.innerHTML = `📁 Carpetas (${carpetas.length})`;
        seccionCarpetas.appendChild(titleCarpetas);
      }

      const gridCarpetas = document.createElement('div');
      gridCarpetas.className = 'drive-grid-layout';

      carpetas.forEach(c => {
        const nombreLimpio = this.formatearTexto(c.nombre);
        const card = document.createElement('div');
        card.className = 'tarjeta-recurso-carpeta';
        card.title = nombreLimpio;

        card.innerHTML = `
          <div class="tarjeta-carpeta-icon">
            ${this.iconos.carpeta}
          </div>
          <div class="tarjeta-carpeta-info">
            <h3 class="tarjeta-carpeta-title">${this.escapeHTML(nombreLimpio)}</h3>
            <span class="tarjeta-carpeta-sub">Abrir carpeta</span>
          </div>
          <span class="tarjeta-carpeta-arrow">➜</span>
        `;

        card.addEventListener('click', () => {
          this.abrirCarpeta(c.id, c.nombre);
        });

        gridCarpetas.appendChild(card);
      });

      seccionCarpetas.appendChild(gridCarpetas);
      this.contentEl.appendChild(seccionCarpetas);
    }

    // --- SECCIÓN 2: ARCHIVOS ---
    if (archivos.length > 0) {
      const seccionArchivos = document.createElement('div');
      seccionArchivos.className = 'drive-section-group';

      if (carpetas.length > 0 || this.ruta.length > 1) {
        const titleArchivos = document.createElement('div');
        titleArchivos.className = 'drive-section-title';
        titleArchivos.innerHTML = `📄 Archivos (${archivos.length})`;
        seccionArchivos.appendChild(titleArchivos);
      }

      const gridArchivos = document.createElement('div');
      gridArchivos.className = 'drive-grid-layout';

      archivos.forEach(a => {
        const card = this.crearTarjetaArchivo(a, carpetaPadreNombre);
        gridArchivos.appendChild(card);
      });

      seccionArchivos.appendChild(gridArchivos);
      this.contentEl.appendChild(seccionArchivos);
    }
  }

  // 4. Creación de Tarjeta de Archivo con Miniatura y Descarga
  crearTarjetaArchivo(archivo, nombreCarpetaActual) {
    const titulo = this.formatearTexto(archivo.titulo || 'Recurso sin título');
    const rutaArchivo = archivo.ruta_archivo || '';
    const driveId = this.extraerGoogleDriveId(rutaArchivo);

    // URL de la miniatura de Google Drive
    const thumbUrl = driveId
      ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`
      : (rutaArchivo.startsWith('http') ? rutaArchivo : `ver_archivo.php?id=${archivo.id}`);

    // Detección de extensión / tipo
    const ext = (rutaArchivo || titulo).split('.').pop().toUpperCase();
    const badgeExt = ['PDF', 'PNG', 'JPG', 'JPEG', 'WEBP', 'DOCX'].includes(ext) ? ext : 'FICHA';

    const card = document.createElement('div');
    card.className = 'tarjeta-recurso-archivo';
    card.title = titulo;

    card.innerHTML = `
      <!-- Encabezado con Icono Azul Claro y Título Truncado -->
      <div class="tarjeta-archivo-header">
        <span class="tarjeta-archivo-icon">
          ${this.iconos.archivo}
        </span>
        <h3 class="tarjeta-archivo-title">${this.escapeHTML(titulo)}</h3>
      </div>

      <!-- Miniatura con Preview de Google Drive -->
      <div class="tarjeta-archivo-preview">
        <img
          src="${thumbUrl}"
          alt="${this.escapeHTML(titulo)}"
          class="tarjeta-archivo-thumb-img"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="tarjeta-archivo-fallback-icon" style="display:none;">
          📄
        </div>
        <div class="tarjeta-archivo-overlay">
          <span>Abrir Recurso ↗</span>
        </div>
      </div>

      <!-- Cuerpo / Badges de Metadatos -->
      <div class="tarjeta-archivo-body">
        <span class="tarjeta-badge">${this.escapeHTML(nombreCarpetaActual)}</span>
        <span class="tarjeta-badge-sub">${badgeExt}</span>
      </div>

      <!-- Pie de Tarjeta con Texto y Botón de Descarga -->
      <div class="tarjeta-archivo-footer">
        <span class="tarjeta-footer-grade">${this.escapeHTML(nombreCarpetaActual)}</span>
        <a
          href="ver_archivo.php?id=${archivo.id}&download=true"
          class="btn-descargar-tarjeta"
          onclick="event.stopPropagation()"
          title="Descargar archivo"
        >
          ${this.iconos.descarga}
          Descargar
        </a>
      </div>
    `;

    // Clic en la tarjeta abre el visor del archivo
    card.addEventListener('click', () => {
      this.abrirArchivo(archivo);
    });

    return card;
  }

  // 5. Expresión regular para extraer el ID de Google Drive
  extraerGoogleDriveId(url) {
    if (!url) return null;
    const s = String(url).trim();
    const matchFileD = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFileD) return matchFileD[1];
    const matchId = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId) return matchId[1];
    const matchD = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD) return matchD[1];
    return null;
  }

  // 6. Normalizador y limpiador de caracteres con errores de codificación
  formatearTexto(str) {
    if (!str) return '';
    let s = String(str);

    // Corregir patrones comunes con caracteres '?' causados por codificación
    s = s.replace(/Nu\?meros/gi, 'Números')
         .replace(/Relacio\?n/gi, 'Relación')
         .replace(/Medicio\?n/gi, 'Medición')
         .replace(/Geometri\?a/gi, 'Geometría')
         .replace(/Espan\?ol/gi, 'Español')
         .replace(/Operacio\?n/gi, 'Operación')
         .replace(/Fraccio\?n/gi, 'Fracción')
         .replace(/Multiplicacio\?n/gi, 'Multiplicación')
         .replace(/Divisio\?n/gi, 'División')
         .replace(/Evaluacio\?n/gi, 'Evaluación')
         .replace(/Leccio\?n/gi, 'Lección');

    // Limpiar guiones bajos iniciales como "2_ Valor" -> "2. Valor" o "4_ Suma" -> "4. Suma"
    s = s.replace(/^(\d+)_\s*/, '$1. ');

    return s;
  }

  mostrarCargando() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="drive-status-state">
        <div class="drive-spinner"></div>
        <p>Cargando recursos...</p>
      </div>
    `;
  }

  mostrarError(msg) {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = `
      <div class="drive-status-state" style="color: #ef4444;">
        <p>⚠️ ${this.escapeHTML(msg)}</p>
      </div>
    `;
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
}

// Exportación global para navegadores
window.GoogleDriveManager = GoogleDriveManager;
