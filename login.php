<?php
// login.php - Backend de Autenticación para MATH Minds
// Configuración de cabeceras CORS y JSON
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Responder inmediatamente a peticiones preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Desactivar salida HTML de errores para no romper el formato JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    // 1. Incluir archivo de conexión
    if (!file_exists('conexion.php')) {
        echo json_encode([
            "success" => false,
            "mensaje" => "Error crítico: No se encontró el archivo conexion.php en el servidor."
        ]);
        exit;
    }

    require_once 'conexion.php';

    // Asegurar variable de conexión ($conexion o $pdo)
    if (!isset($conexion)) {
        if (isset($pdo)) {
            $conexion = $pdo;
        } elseif (isset($conn)) {
            $conexion = $conn;
        } elseif (isset($db)) {
            $conexion = $db;
        } else {
            echo json_encode([
                "success" => false,
                "mensaje" => "Error de configuración: La variable de conexión no está disponible en conexion.php."
            ]);
            exit;
        }
    }

    // Diagnóstico rápido si se abre login.php directamente desde el navegador (GET)
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Comprobar si la tabla existe
        $stmtCheck = $conexion->query("SHOW TABLES LIKE 'usuarios'");
        $tablaExiste = $stmtCheck->rowCount() > 0;
        
        echo json_encode([
            "success" => true,
            "mensaje" => "Servicio de autenticación activo y conectado a la base de datos.",
            "base_de_datos" => "Conectada correctamente",
            "tabla_usuarios_existe" => $tablaExiste
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2. Leer datos enviados en formato JSON desde JavaScript
    $inputJSON = file_get_contents('php://input');
    $data = json_decode($inputJSON, true);

    // Fallback por si vinieran por formulario POST tradicional
    if (!$data && !empty($_POST)) {
        $data = $_POST;
    }

    // 3. Validar que vengan email y password
    if (!isset($data['email']) || !isset($data['password'])) {
        echo json_encode([
            "success" => false,
            "mensaje" => "Faltan datos obligatorios (correo o contraseña no recibidos)."
        ]);
        exit;
    }

    $email = trim($data['email']);
    $password = trim($data['password']);

    if ($email === '' || $password === '') {
        echo json_encode([
            "success" => false,
            "mensaje" => "Por favor ingresa tanto el correo como la contraseña."
        ]);
        exit;
    }

    // 4. Buscar usuario en la base de datos (con soporte para distintas mayúsculas/minúsculas)
    $sql = "SELECT * FROM usuarios WHERE LOWER(TRIM(email)) = LOWER(:email) LIMIT 1";
    $stmt = $conexion->prepare($sql);
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario) {
        echo json_encode([
            "success" => false,
            "mensaje" => "El correo electrónico no se encuentra registrado."
        ]);
        exit;
    }

    // Extraer campos de manera flexible por si tienen variaciones en mayúsculas
    $dbPassword = $usuario['password'] ?? $usuario['Password'] ?? $usuario['clave'] ?? $usuario['pass'] ?? '';
    $nombre     = $usuario['nombre'] ?? $usuario['Nombre'] ?? $usuario['name'] ?? $email;
    $rol        = strtolower(trim($usuario['rol'] ?? $usuario['Rol'] ?? $usuario['role'] ?? 'estudiante'));
    $id         = $usuario['id'] ?? $usuario['ID'] ?? null;

    $dbPasswordTrimmed = trim((string)$dbPassword);

    // 5. Validar contraseña: texto plano O cifrado con password_hash()
    $passwordValida = ($password === $dbPasswordTrimmed) || password_verify($password, $dbPasswordTrimmed);

    if (!$passwordValida) {
        echo json_encode([
            "success" => false,
            "mensaje" => "Contraseña incorrecta."
        ]);
        exit;
    }

    // 6. Iniciar sesión PHP en el servidor si no está iniciada
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $_SESSION['user_id']     = $id;
    $_SESSION['user_nombre'] = $nombre;
    $_SESSION['user_email']  = $email;
    $_SESSION['user_rol']    = $rol;

    // 7. Respuesta exitosa
    echo json_encode([
        "success" => true,
        "mensaje" => "Bienvenido " . $nombre,
        "id"      => $id,
        "nombre"  => $nombre,
        "email"   => $email,
        "rol"     => $rol // 'admin' o 'estudiante'
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    // Captura cualquier error de MySQL o PHP y devuelve un JSON claro
    http_response_code(200); // Responder con 200 para que JavaScript pueda leer el JSON de error
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos o servidor: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
?>
